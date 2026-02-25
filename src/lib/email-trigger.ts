import { supabase } from "@/integrations/supabase/client";
import { generateDanfePdfBase64, generateNfeFilename } from "./nfe-utils";

type ShipmentStatus = "pendente" | "em_transito" | "saiu_para_entrega" | "entregue";

/**
 * Triggers only the NEXT email event for a shipment.
 * Returns the new status and ultimo_evento_ordem, or null if nothing to send.
 */
export async function triggerNextEmail(envioId: string, lojaId: string): Promise<{ status: ShipmentStatus; ultimoOrdem: number } | null> {
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

        // 4. Find the NEXT event (ordem > ultimo_evento_ordem)
        const currentOrdem = (shipment as any).ultimo_evento_ordem ?? 0;
        const nextEvent = allEvents.find(e => e.ordem > currentOrdem);

        if (!nextEvent) {
            console.log("Trigger skip: no more events to send");
            return null;
        }

        // 5. Determine new status based on position
        const totalEvents = allEvents.length;
        const eventIndex = allEvents.indexOf(nextEvent);
        let newStatus: ShipmentStatus;

        if (eventIndex === totalEvents - 1) {
            newStatus = "entregue";
        } else if (eventIndex === totalEvents - 2) {
            newStatus = "saiu_para_entrega";
        } else {
            newStatus = "em_transito";
        }

        // 6. Update envio with new ordem and status
        const { error: uErr } = await supabase
            .from("envios")
            .update({ 
                ultimo_evento_ordem: nextEvent.ordem, 
                status: newStatus,
                status_label: nextEvent.status_label 
            })
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

        if (!isAtivo || !nextEvent.enviar_email) {
            console.log("Trigger skip: event disabled, but status advanced", nextEvent.nome);
            return { status: newStatus, ultimoOrdem: nextEvent.ordem };
        }

        // 8. Build payload and send
        let nfe_pdf_base64 = "";
        let nfe_filename = "";

        if (nextEvent.enviar_nfe_pdf && shipment.empresas) {
            try {
                nfe_pdf_base64 = await generateDanfePdfBase64(shipment.empresas as any, shipment as any);
                nfe_filename = generateNfeFilename();
            } catch (pdfErr) {
                console.error("PDF generation failed:", pdfErr);
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
                nfe_pdf_base64,
                nfe_filename,
            },
        });

        if (funcErr) {
            console.error("Edge function failed for event:", nextEvent.nome, funcErr);
        } else {
            console.log("Email sent for event:", nextEvent.nome);
        }

        return { status: newStatus, ultimoOrdem: nextEvent.ordem };

    } catch (err) {
        console.error("Global trigger error:", err);
        return null;
    }
}
