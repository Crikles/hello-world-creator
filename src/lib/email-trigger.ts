import { supabase } from "@/integrations/supabase/client";

type ShipmentStatus = "pendente" | "em_transito" | "saiu_para_entrega" | "entregue";

export class InsufficientBalanceError extends Error {
    constructor() {
        super("Saldo insuficiente de moedas para processar este envio.");
        this.name = "InsufficientBalanceError";
    }
}

// Última razão pela qual triggerNextEmail retornou null (para diagnóstico em lotes)
let _lastSkipReason: string | null = null;
export function getLastSkipReason(): string | null { return _lastSkipReason; }
export function resetSkipReason() { _lastSkipReason = null; }
function skip(reason: string, ctx?: any) {
    _lastSkipReason = reason;
    console.log("[triggerNextEmail] SKIP:", reason, ctx ?? "");
    return null;
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
            return skip("envio não encontrado (RLS ou id inválido)", { envioId, sErr: sErr?.message });
        }

        // Fallback: fetch empresa by loja_id if empresa_id was not set
        if (!shipment.empresas && shipment.loja_id) {
            const { data: fallbackEmpresa } = await supabase
                .from("empresas").select("*").eq("loja_id", shipment.loja_id).maybeSingle();
            if (fallbackEmpresa) (shipment as any).empresas = fallbackEmpresa;
        }

        // ── Roteamento Fluxo GLOBAL (envios internacionais) ──
        if ((shipment as any).is_international) {
            return await triggerGlobalFlowNext(shipment, lojaId, forceAdvance);
        }

        // 1.5. Check delay constraint — block if proximo_avanco_em is in the future
        const proximoAvanco = (shipment as any).proximo_avanco_em;
        if (!forceAdvance && proximoAvanco && new Date(proximoAvanco) > new Date()) {
            return skip(`delay ainda não expirou (próximo avanço ${proximoAvanco})`, { envioId });
        }

        // 2. Fetch store configuration
        const { data: config, error: cErr } = await supabase
            .from("postagem_config")
            .select("*")
            .eq("loja_id", lojaId)
            .maybeSingle();

        if (cErr || !config) {
            return skip("postagem_config não encontrada para a loja", { lojaId, cErr: cErr?.message });
        }

        const templateIdToUse = (shipment as any).postagem_template_id || config.template_ativo_id;

        if (!templateIdToUse) {
            return skip("nenhum template ativo definido em Postagem → Templates", { lojaId });
        }

        // 3. Fetch ALL events for the active template, ordered
        const { data: allEvents, error: eErr } = await supabase
            .from("postagem_eventos")
            .select("*")
            .eq("template_id", templateIdToUse)
            .order("ordem", { ascending: true });

        if (eErr || !allEvents || allEvents.length === 0) {
            return skip("template ativo não possui eventos cadastrados", { templateIdToUse, eErr: eErr?.message });
        }

        const filteredEvents = allEvents.filter(e => {
            // Remove NF-e events when enviar_nfe_email is disabled
            if (!config.enviar_nfe_email && e.enviar_nfe_pdf) return false;
            return true;
        });

        // 4. Find the NEXT event (ordem > ultimo_evento_ordem)
        const currentOrdem = (shipment as any).ultimo_evento_ordem ?? 0;

        const nextEvent = filteredEvents.find(e => e.ordem > currentOrdem);

        if (!nextEvent) {
            return skip("não há próximo evento no template a partir da ordem atual", { currentOrdem });
        }

        // ── REGRA: Evento "Entregue" (último) é SEMPRE manual ──
        // Bloqueia avanço automático para "Entregue" — só prossegue com forceAdvance=true
        const isFinalDelivered =
            nextEvent.nome === "Entregue" ||
            filteredEvents.indexOf(nextEvent) === filteredEvents.length - 1;

        if (isFinalDelivered && !forceAdvance) {
            console.log("Trigger skip: 'Entregue' requires manual confirmation", envioId);
            return null;
        }

        // (Eventos Falha Entrega / Taxação / Pago foram removidos do sistema.)


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
        const nfeJaCobrado = (shipment as any).nfe_cobrado === true;
        if (currentOrdem === 0) {
            let total = 0;
            const activeServices: string[] = [];
            let chargingNfe = false;

            if (config.enviar_nfe_email && costMap["custo_nfe_email"] && !nfeJaCobrado) {
                total += costMap["custo_nfe_email"];
                activeServices.push("NF-e");
                chargingNfe = true;
            }
            if (config.enviar_emails && costMap["custo_email_rastreio"]) {
                total += costMap["custo_email_rastreio"];
                activeServices.push("E-mail");
            }
            // SMS removido da cobrança inicial — cobrado individualmente a cada envio


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

                // Marca NF-e como cobrada para evitar dupla cobrança em download manual
                if (chargingNfe) {
                    await supabase.from("envios").update({ nfe_cobrado: true }).eq("id", envioId);
                }
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

        // 6b. Update envio with optimistic lock — prevents race with cron advance-shipments
        const { data: updatedRows, error: uErr } = await supabase
            .from("envios")
            .update({
                ultimo_evento_ordem: nextEvent.ordem,
                status: newStatus,
                status_label: nextEvent.status_label,
                proximo_avanco_em: proximoAvancoEm,
            } as any)
            .eq("id", envioId)
            .eq("ultimo_evento_ordem", currentOrdem)
            .select("id");

        if (uErr) {
            console.error("Failed to update envio ordem/status:", uErr);
            return null;
        }

        // Race condition: outro processo (cron ou outra aba) já avançou este envio
        if (!updatedRows || updatedRows.length === 0) {
            console.log("Trigger skip: envio já avançado por outro processo (lock)", envioId);
            // Nota: o débito feito acima (currentOrdem===0) NÃO é estornado aqui porque
            // o outro processo (cron) avançou e provavelmente NÃO debitou (já estava em ordem 0
            // antes do nosso update; o cron usa o mesmo lock e perderia também). Em prática,
            // apenas um dos dois consegue debitar+avançar. Se ambos debitarem, o estorno
            // seria necessário — mas isso é cobertura futura.
            return null;
        }

        // 7. Check if this event should actually send an email
        const evNome = (nextEvent.nome || "").trim();
        let isAtivo = false;
        if (nextEvent.enviar_nfe_pdf) {
            isAtivo = config.enviar_nfe_email;
        } else {
            isAtivo = config.enviar_emails;
        }

        // Evento "Entregue": NUNCA enviar e-mail nem SMS, só atualizar status
        if (isFinalDelivered) {
            console.log("Trigger: 'Entregue' marcado manualmente — sem e-mail/SMS", envioId);
            return { status: newStatus, ultimoOrdem: nextEvent.ordem };
        }

        if ((!isAtivo && !forceSendEmail) || !nextEvent.enviar_email) {
            console.log("Trigger skip: event disabled, but status advanced", nextEvent.nome);
            return { status: newStatus, ultimoOrdem: nextEvent.ordem };
        }

        // 8. Build payload and send — PDF is now generated server-side
        console.log("Invoking send-email for event:", {
            envio_id: shipment.id,
            evento_id: nextEvent.id,
            evento_nome: nextEvent.nome,
            loja_id: lojaId,
            generate_nfe_server: nextEvent.enviar_nfe_pdf,
        });

        // Invoca send-email com retry em caso de rate limit do Functions runtime
        let funcErr: any = null;
        for (let attempt = 0; attempt < 4; attempt++) {
            const res = await supabase.functions.invoke("send-email", {
                body: {
                    envio_id: shipment.id,
                    evento_id: nextEvent.id,
                    loja_id: lojaId,
                    generate_nfe_server: nextEvent.enviar_nfe_pdf || false,
                },
            });
            funcErr = res.error;
            if (!funcErr) break;
            const retryMs = (funcErr as any)?.context?.retryAfterMs ?? (funcErr as any)?.context?.retry_after_ms;
            const isRateLimit = (funcErr as any)?.context?.name === "RateLimitError" || typeof retryMs === "number";
            if (!isRateLimit || attempt === 3) break;
            const waitMs = Math.min((retryMs || 2000) + 500, 15000);
            console.warn(`Rate limit ao invocar send-email (envio ${shipment.id}); aguardando ${waitMs}ms (tentativa ${attempt + 1}/4)`);
            await new Promise(r => setTimeout(r, waitMs));
        }

        if (funcErr) {
            console.error("Edge function failed for event:", nextEvent.nome, funcErr);
        } else {
            console.log("Email sent for event:", nextEvent.nome);
        }


        // SMS dispatch — charged individually per message, only when the flow is active
        if (
            isAtivo &&
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

        // Process cashback when flow completes
        if (newStatus === "entregue") {
            try {
                const { data: cashbackVal, error: cbErr } = await supabase.rpc("process_cashback" as any, {
                    _envio_id: envioId,
                    _user_id: lojaUserId,
                });
                if (cbErr) {
                    console.error("Cashback RPC error:", cbErr);
                } else if (cashbackVal && Number(cashbackVal) > 0) {
                    console.log(`Cashback: ${cashbackVal} credits returned for envio ${envioId}`);
                }
            } catch (cbErr) {
                console.error("Cashback failed:", cbErr);
            }
        }

        return { status: newStatus, ultimoOrdem: nextEvent.ordem };

    } catch (err) {
        if (err instanceof InsufficientBalanceError) throw err;
        console.error("Global trigger error:", err);
        return null;
    }
}

/**
 * Avança o próximo passo do FLUXO GLOBAL (envios internacionais).
 * Usa global_flow_eventos (10 steps) e invoca send-global-flow.
 */
async function triggerGlobalFlowNext(
    shipment: any,
    lojaId: string,
    forceAdvance: boolean
): Promise<{ status: ShipmentStatus; ultimoOrdem: number } | null> {
    try {
        // Respeitar delay
        const proximoAvanco = shipment.proximo_avanco_em;
        if (!forceAdvance && proximoAvanco && new Date(proximoAvanco) > new Date()) {
            console.log("Global trigger skip: delay not elapsed", shipment.id);
            return null;
        }

        const { data: gfc } = await supabase
            .from("global_flow_config")
            .select("ativo")
            .eq("loja_id", lojaId)
            .maybeSingle();

        if (!gfc?.ativo) {
            console.log("Global trigger skip: global flow not active", lojaId);
            return null;
        }

        const { data: eventos } = await supabase
            .from("global_flow_eventos")
            .select("step_order, delay_horas")
            .eq("loja_id", lojaId)
            .order("step_order", { ascending: true });

        if (!eventos || eventos.length === 0) {
            console.log("Global trigger skip: no global_flow_eventos", lojaId);
            return null;
        }

        const totalSteps = eventos.length;
        const currentOrdem: number = shipment.ultimo_evento_ordem ?? 0;
        const nextStep = currentOrdem + 1;
        if (nextStep > totalSteps) return null;

        // Último passo (entregue) só manualmente
        const isFinalDelivered = nextStep === totalSteps;
        if (isFinalDelivered && !forceAdvance) {
            console.log("Global trigger skip: 'Entregue' manual only", shipment.id);
            return null;
        }

        // Status novo
        let newStatus: ShipmentStatus;
        if (nextStep === totalSteps) newStatus = "entregue";
        else if (nextStep === totalSteps - 1) newStatus = "saiu_para_entrega";
        else newStatus = "em_transito";

        // Próximo delay (delay do próximo step depois desse)
        const followingEvent = eventos.find((e: any) => e.step_order > nextStep);
        const proximoAvancoEm = followingEvent && followingEvent.delay_horas > 0
            ? new Date(Date.now() + followingEvent.delay_horas * 3600000).toISOString()
            : null;

        // Update com lock otimista
        const { data: updatedRows, error: uErr } = await supabase
            .from("envios")
            .update({
                ultimo_evento_ordem: nextStep,
                status: newStatus,
                proximo_avanco_em: proximoAvancoEm,
            } as any)
            .eq("id", shipment.id)
            .eq("ultimo_evento_ordem", currentOrdem)
            .select("id");

        if (uErr) {
            console.error("Global trigger update fail:", uErr);
            return null;
        }
        if (!updatedRows || updatedRows.length === 0) {
            console.log("Global trigger skip: race lost", shipment.id);
            return null;
        }

        // Final entregue: não dispara email
        if (isFinalDelivered) {
            return { status: newStatus, ultimoOrdem: nextStep };
        }

        // Invocar send-global-flow
        const { error: funcErr } = await supabase.functions.invoke("send-global-flow", {
            body: { envio_id: shipment.id, step: nextStep },
        });
        if (funcErr) {
            console.error("send-global-flow failed:", funcErr);
        }

        return { status: newStatus, ultimoOrdem: nextStep };
    } catch (err) {
        console.error("triggerGlobalFlowNext error:", err);
        return null;
    }
}
