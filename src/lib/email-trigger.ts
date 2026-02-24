import { supabase } from "@/integrations/supabase/client";
import { generateDanfePdfBase64, generateNfeFilename } from "./nfe-utils";

export async function triggerShipmentEmail(envioId: string, status: string, lojaId: string) {
    try {
        // 1. Fetch shipment with empresa details
        const { data: shipment, error: sErr } = await supabase
            .from("envios")
            .select("*, empresas(*)")
            .eq("id", envioId)
            .single();

        if (sErr || !shipment) {
            console.error("Trigger fail: shipment not found", envioId);
            return;
        }

        // 2. Fetch store configuration
        const { data: config, error: cErr } = await supabase
            .from("postagem_config")
            .select("*")
            .eq("loja_id", lojaId)
            .maybeSingle();

        if (cErr || !config || !config.template_ativo_id) {
            console.log("Trigger skip: no active template for loja", lojaId);
            return;
        }

        // 3. Find relevant events
        const statusLabelsMap: Record<string, string[]> = {
            pendente: ["Postado", "Pedido Confirmado", "Nota Fiscal Emitida"],
            coletado: ["Coletado"],
            em_transito: ["Em Trânsito", "Em Rota", "Centro Local"],
            saiu_para_entrega: ["Saiu para Entrega"],
            entregue: ["Entregue"],
            centro_local: ["Centro Local"],
            taxacao: ["Taxação"],
            pagamento_confirmado: ["Pago"],
        };

        const targetLabels = statusLabelsMap[status] || [status];

        const { data: events, error: eErr } = await supabase
            .from("postagem_eventos")
            .select("*")
            .eq("template_id", config.template_ativo_id)
            .in("status_label", targetLabels)
            .order("ordem", { ascending: true });

        if (eErr || !events || events.length === 0) {
            console.log("Trigger skip: no matching event for status", status);
            return;
        }

        // 4. Loop through ALL matching events
        for (const event of events) {
            // Check if event is active based on shop flags
            let isAtivo = false;
            if (event.enviar_nfe_pdf) {
                isAtivo = config.enviar_nfe_email;
            } else if (event.status_label === "Taxação" || event.status_label === "Pago") {
                isAtivo = config.ativar_taxacao;
            } else {
                isAtivo = config.enviar_emails;
            }

            if (!isAtivo || !event.enviar_email) {
                console.log("Trigger skip: event/config disabled", event.nome);
                continue;
            }

            // Build payload
            let nfe_pdf_base64 = "";
            let nfe_filename = "";

            if (event.enviar_nfe_pdf && shipment.empresas) {
                try {
                    nfe_pdf_base64 = await generateDanfePdfBase64(shipment.empresas as any, shipment as any);
                    nfe_filename = generateNfeFilename();
                } catch (pdfErr) {
                    console.error("PDF generation failed:", pdfErr);
                }
            }

            // Invoke edge function for this event
            console.log("Invoking send-email for event:", {
                envio_id: shipment.id,
                evento_id: event.id,
                evento_nome: event.nome,
                loja_id: lojaId,
                has_nfe_pdf: !!nfe_pdf_base64,
            });

            const { data: funcData, error: funcErr } = await supabase.functions.invoke("send-email", {
                body: {
                    envio_id: shipment.id,
                    evento_id: event.id,
                    loja_id: lojaId,
                    nfe_pdf_base64,
                    nfe_filename,
                },
            });

            if (funcErr) {
                console.error("Edge function failed for event:", event.nome, funcErr);
            } else {
                console.log("Email sent for event:", event.nome, funcData);
            }
        }

    } catch (err) {
        console.error("Global trigger error:", err);
    }
}
