import { supabase } from "@/integrations/supabase/client";
import { generateDanfePdfBase64, generateNfeFilename } from "./nfe-utils";

type ShipmentStatus = "pendente" | "em_transito" | "saiu_para_entrega" | "entregue";

/**
 * Triggers only the NEXT email event for a shipment.
 * Returns the new status and ultimo_evento_ordem, or null if nothing to send.
 */
export class InsufficientBalanceError extends Error {
    constructor() {
        super("Saldo insuficiente de moedas para processar este envio.");
        this.name = "InsufficientBalanceError";
    }
}

export async function triggerNextEmail(envioId: string, lojaId: string, forceSendEmail: boolean = false, forceAdvance: boolean = false): Promise<{ status: ShipmentStatus; ultimoOrdem: number } | null> {
    try {
        // 1. Fetch shipment with empresa details
        const { data: shipment, error: sErr } = await supabase
            .from("envios")
            .select("*, empresas(*)")
            .eq("id", envioId)
            .single();

        if (sErr || !shipment) {
            console.error("Trigger fail: shipment not found", envioId);
            return null;
        }

        // 1.5. Check delay constraint — block if proximo_avanco_em is in the future
        const proximoAvanco = (shipment as any).proximo_avanco_em;
        if (!forceAdvance && proximoAvanco && new Date(proximoAvanco) > new Date()) {
            console.log("Trigger skip: delay not elapsed yet for envio", envioId, "next advance at", proximoAvanco);
            return null;
        }

        // 2. Fetch store configuration
        const { data: config, error: cErr } = await supabase
            .from("postagem_config")
            .select("*")
            .eq("loja_id", lojaId)
            .maybeSingle();

        if (cErr || !config || !config.template_ativo_id) {
            console.log("Trigger skip: no active template for loja", lojaId);
            return null;
        }

        // 3. Fetch ALL events for the active template, ordered
        const { data: allEvents, error: eErr } = await supabase
            .from("postagem_eventos")
            .select("*")
            .eq("template_id", config.template_ativo_id)
            .order("ordem", { ascending: true });

        if (eErr || !allEvents || allEvents.length === 0) {
            console.log("Trigger skip: no events in template");
            return null;
        }

        // Filter out "Falha Entrega/Falha na Entrega" if config.ativar_falha_entrega is not true
        const filteredEvents = allEvents.filter(e => {
            if ((e.status_label === "Falha Entrega" || e.nome === "Falha na Entrega") && !(config as any).ativar_falha_entrega) {
                return false;
            }
            // Remove NF-e events when enviar_nfe_email is disabled
            if (!config.enviar_nfe_email && e.enviar_nfe_pdf) return false;
            return true;
        });

        // Re-calculate the ordens mathematically so the index doesn't skip
        filteredEvents.forEach((ev, idx) => {
            // Keep original logic untouched, we just run on `filteredEvents` instead of `allEvents`
        });

        // 4. Find the NEXT event (ordem > ultimo_evento_ordem)
        const currentOrdem = (shipment as any).ultimo_evento_ordem ?? 0;
        const nextEvent = filteredEvents.find(e => e.ordem > currentOrdem);

        if (!nextEvent) {
            console.log("Trigger skip: no more events to send");
            return null;
        }

        // ── Fetch user_id and costs (needed for initial debit AND per-SMS debit) ──
        const { data: lojaData, error: lojaErr } = await supabase
            .from("lojas")
            .select("user_id")
            .eq("id", lojaId)
            .single();

        if (lojaErr || !lojaData) {
            console.error("Failed to fetch loja user_id:", lojaErr);
            return null;
        }

        const lojaUserId = lojaData.user_id;

        const { data: profileData, error: profileErr } = await supabase
            .from("profiles")
            .select("custom_prices")
            .eq("id", lojaUserId)
            .single();

        if (profileErr) {
            console.warn("Could not fetch user profile for custom prices:", profileErr);
        }

        const customPrices = (profileData?.custom_prices as Record<string, number> | null) || {};

        const { data: costs, error: costsErr } = await supabase
            .from("system_config")
            .select("key, value");

        if (costsErr || !costs) {
            console.error("Failed to fetch system_config costs:", costsErr);
            return null;
        }

        const costMap: Record<string, number> = {};
        for (const c of costs) {
            costMap[c.key] = customPrices[c.key] !== undefined ? Number(customPrices[c.key]) : Number(c.value);
        }

        // 4.5. Debit credits on first event (currentOrdem == 0) — SMS excluded, charged per-send
        if (currentOrdem === 0) {
            let total = 0;
            const activeServices: string[] = [];

            if (config.enviar_nfe_email && costMap["custo_nfe_email"]) {
                total += costMap["custo_nfe_email"];
                activeServices.push("NF-e");
            }
            if (config.enviar_emails && costMap["custo_email_rastreio"]) {
                total += costMap["custo_email_rastreio"];
                activeServices.push("E-mail");
            }
            // SMS removido da cobrança inicial — cobrado individualmente a cada envio
            if (config.ativar_taxacao && costMap["custo_taxacao"]) {
                total += costMap["custo_taxacao"];
                activeServices.push("Taxação");
            }
            if (config.ativar_falha_entrega && costMap["custo_falha_entrega"]) {
                total += costMap["custo_falha_entrega"];
                activeServices.push("Falha na Entrega");
            }

            if (total > 0) {
                const descricao = `Envio processado (${activeServices.join(", ")})`;
                const { data: debitOk, error: debitErr } = await supabase.rpc("debit_user_credits", {
                    _user_id: lojaUserId,
                    _quantidade: total,
                    _descricao: descricao,
                });

                if (debitErr) {
                    console.error("Debit RPC error:", debitErr);
                    return null;
                }

                if (!debitOk) {
                    console.warn("Insufficient balance for user:", lojaUserId);
                    throw new InsufficientBalanceError();
                }

                console.log(`Debited ${total} credits for envio ${envioId}:`, descricao);
            }
        }

        // 5. Determine new status based on position
        const totalEvents = filteredEvents.length;
        const eventIndex = filteredEvents.indexOf(nextEvent);
        let newStatus: ShipmentStatus;

        if (eventIndex === totalEvents - 1) {
            newStatus = "entregue";
        } else if (eventIndex === totalEvents - 2) {
            newStatus = "saiu_para_entrega";
        } else {
            newStatus = "em_transito";
        }

        // 6. Calculate proximo_avanco_em based on following event's delay_horas
        const followingEvent = filteredEvents.find(e => e.ordem > nextEvent.ordem);
        const proximoAvancoEm = followingEvent && followingEvent.delay_horas > 0
            ? new Date(Date.now() + followingEvent.delay_horas * 3600000).toISOString()
            : null;

        // 6b. Update envio with new ordem, status, and next allowed advance time
        const { error: uErr } = await supabase
            .from("envios")
            .update({
                ultimo_evento_ordem: nextEvent.ordem,
                status: newStatus,
                status_label: nextEvent.status_label,
                proximo_avanco_em: proximoAvancoEm,
            } as any)
            .eq("id", envioId);

        if (uErr) {
            console.error("Failed to update envio ordem/status:", uErr);
            return null;
        }

        // 7. Check if this event should actually send an email
        let isAtivo = false;
        if (nextEvent.enviar_nfe_pdf) {
            isAtivo = config.enviar_nfe_email;
        } else if (nextEvent.status_label === "Taxação" || nextEvent.status_label === "Pago") {
            isAtivo = config.ativar_taxacao;
        } else {
            isAtivo = config.enviar_emails;
        }

        if ((!isAtivo && !forceSendEmail) || !nextEvent.enviar_email) {
            console.log("Trigger skip: event disabled, but status advanced", nextEvent.nome);
            return { status: newStatus, ultimoOrdem: nextEvent.ordem };
        }

        // 8. Build payload and send
        let nfe_storage_path = "";
        let nfe_filename = "";

        if (nextEvent.enviar_nfe_pdf && shipment.empresas) {
            try {
                const base64 = await generateDanfePdfBase64(shipment.empresas as any, shipment as any);
                nfe_filename = generateNfeFilename();

                const byteChars = atob(base64);
                const byteNumbers = new Array(byteChars.length);
                for (let i = 0; i < byteChars.length; i++) {
                    byteNumbers[i] = byteChars.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: "application/pdf" });

                const storagePath = `${envioId}/${nfe_filename}`;
                const { error: uploadErr } = await supabase.storage
                    .from("nfe-pdfs")
                    .upload(storagePath, blob, { contentType: "application/pdf", upsert: true });

                if (uploadErr) {
                    console.error("PDF upload to storage failed:", uploadErr);
                } else {
                    nfe_storage_path = storagePath;
                    console.log("PDF uploaded to storage:", storagePath);
                }
            } catch (pdfErr) {
                console.error("PDF generation/upload failed:", pdfErr);
            }
        }

        console.log("Invoking send-email for event:", {
            envio_id: shipment.id,
            evento_id: nextEvent.id,
            evento_nome: nextEvent.nome,
            loja_id: lojaId,
        });

        const { error: funcErr } = await supabase.functions.invoke("send-email", {
            body: {
                envio_id: shipment.id,
                evento_id: nextEvent.id,
                loja_id: lojaId,
                nfe_storage_path,
                nfe_filename,
            },
        });

        if (funcErr) {
            console.error("Edge function failed for event:", nextEvent.nome, funcErr);
        } else {
            console.log("Email sent for event:", nextEvent.nome);
        }

        // SMS dispatch — charged individually per message
        if (
            config.ativar_site_rastreio &&
            shipment.cliente_telefone &&
            !nextEvent.enviar_nfe_pdf
        ) {
            const smsCost = costMap["custo_sms_rastreio"] || 0;
            let canSendSms = true;

            if (smsCost > 0) {
                const { data: smsDebitOk, error: smsDebitErr } = await supabase.rpc("debit_user_credits", {
                    _user_id: lojaUserId,
                    _quantidade: smsCost,
                    _descricao: `SMS enviado - ${nextEvent.status_label}`,
                });

                if (smsDebitErr) {
                    console.error("SMS debit RPC error:", smsDebitErr);
                    canSendSms = false;
                } else if (!smsDebitOk) {
                    console.warn("Saldo insuficiente para SMS, pulando envio:", envioId);
                    canSendSms = false;
                } else {
                    console.log(`SMS debit: ${smsCost} credits for envio ${envioId} - ${nextEvent.status_label}`);
                }
            }

            if (canSendSms) {
                console.log("Dispatching SMS for envio:", envioId, "status:", nextEvent.status_label);
                const { error: smsErr } = await supabase.functions.invoke("send-sms", {
                    body: { envio_id: envioId, loja_id: lojaId, status_label: nextEvent.status_label },
                });
                if (smsErr) {
                    console.error("SMS dispatch failed:", smsErr);
                } else {
                    console.log("SMS sent successfully for envio:", envioId);
                }
            }
        }

        return { status: newStatus, ultimoOrdem: nextEvent.ordem };

    } catch (err) {
        if (err instanceof InsufficientBalanceError) throw err;
        console.error("Global trigger error:", err);
        return null;
    }
}
