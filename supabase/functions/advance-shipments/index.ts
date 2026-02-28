import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const now = new Date().toISOString();
  let totalProcessed = 0;
  const MAX_PER_RUN = 50;

  try {
    // Fetch all stores with postagem config
    const { data: configs, error: cfgErr } = await supabase
      .from("postagem_config")
      .select("*, lojas!postagem_config_loja_id_fkey(id, user_id)")
      .not("template_ativo_id", "is", null);

    if (cfgErr || !configs) {
      console.error("Failed to fetch configs:", cfgErr);
      return new Response(JSON.stringify({ error: "Failed to fetch configs" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const config of configs) {
      if (totalProcessed >= MAX_PER_RUN) break;

      const lojaId = config.loja_id;
      // deno-lint-ignore no-explicit-any
      const lojaUserId = (config as any).lojas?.user_id;
      if (!lojaUserId) continue;

      // Fetch template events
      const { data: allEvents } = await supabase
        .from("postagem_eventos")
        .select("*")
        .eq("template_id", config.template_ativo_id)
        .order("ordem", { ascending: true });

      if (!allEvents || allEvents.length === 0) continue;

      // Fetch costs
      const { data: costs } = await supabase
        .from("system_config")
        .select("key, value");

      const costMap: Record<string, number> = {};
      if (costs) for (const c of costs) costMap[c.key] = Number(c.value);

      // --- 1. AUTO-START: new shipments if auto_envio is enabled ---
      // deno-lint-ignore no-explicit-any
      if ((config as any).auto_envio) {
        const { data: pending } = await supabase
          .from("envios")
          .select("id")
          .eq("loja_id", lojaId)
          .eq("status", "pendente")
          .eq("ultimo_evento_ordem", 0)
          .is("deleted_at", null)
          .limit(MAX_PER_RUN - totalProcessed);

        if (pending) {
          for (const envio of pending) {
            if (totalProcessed >= MAX_PER_RUN) break;
            const result = await advanceShipment(
              supabase, envio.id, lojaId, lojaUserId, config, allEvents, costMap
            );
            if (result) totalProcessed++;
          }
        }
      }

      // --- 2. ADVANCE: shipments where delay has expired ---
      if (totalProcessed >= MAX_PER_RUN) break;

      const { data: eligible } = await supabase
        .from("envios")
        .select("id, ultimo_evento_ordem, proximo_avanco_em")
        .eq("loja_id", lojaId)
        .neq("status", "entregue")
        .gt("ultimo_evento_ordem", 0)
        .is("deleted_at", null)
        .limit(MAX_PER_RUN - totalProcessed);

      if (eligible) {
        for (const envio of eligible) {
          if (totalProcessed >= MAX_PER_RUN) break;
          // Check delay
          // deno-lint-ignore no-explicit-any
          const pa = (envio as any).proximo_avanco_em;
          if (pa && new Date(pa) > new Date()) continue; // delay not elapsed

          const result = await advanceShipment(
            supabase, envio.id, lojaId, lojaUserId, config, allEvents, costMap
          );
          if (result) totalProcessed++;
        }
      }
    }

    console.log(`Cron complete: processed ${totalProcessed} shipments`);
    return new Response(
      JSON.stringify({ success: true, processed: totalProcessed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Cron error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// deno-lint-ignore no-explicit-any
async function advanceShipment(
  supabase: any,
  envioId: string,
  lojaId: string,
  lojaUserId: string,
  // deno-lint-ignore no-explicit-any
  config: any,
  // deno-lint-ignore no-explicit-any
  allEvents: any[],
  costMap: Record<string, number>
): Promise<boolean> {
  try {
    // Fetch current shipment state
    const { data: shipment, error: sErr } = await supabase
      .from("envios")
      .select("*")
      .eq("id", envioId)
      .single();

    if (sErr || !shipment) return false;

    const currentOrdem = shipment.ultimo_evento_ordem ?? 0;
    const nextEvent = allEvents.find((e: any) => e.ordem > currentOrdem);
    if (!nextEvent) return false;

    // Debit credits on first event
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
      if (config.ativar_taxacao && costMap["custo_taxacao"]) {
        total += costMap["custo_taxacao"];
        activeServices.push("Taxação");
      }

      if (total > 0) {
        const descricao = `Envio processado (${activeServices.join(", ")})`;
        const { data: debitOk, error: debitErr } = await supabase.rpc("debit_user_credits", {
          _user_id: lojaUserId,
          _quantidade: total,
          _descricao: descricao,
        });

        if (debitErr || !debitOk) {
          console.warn(`Insufficient balance for user ${lojaUserId}, skipping envio ${envioId}`);
          return false;
        }
        console.log(`Debited ${total} credits for envio ${envioId}`);
      }
    }

    // Determine new status
    const totalEvents = allEvents.length;
    const eventIndex = allEvents.indexOf(nextEvent);
    let newStatus: string;

    if (eventIndex === totalEvents - 1) {
      newStatus = "entregue";
    } else if (eventIndex === totalEvents - 2) {
      newStatus = "saiu_para_entrega";
    } else {
      newStatus = "em_transito";
    }

    // Calculate next advance time
    const followingEvent = allEvents.find((e: any) => e.ordem > nextEvent.ordem);
    const proximoAvancoEm = followingEvent && followingEvent.delay_horas > 0
      ? new Date(Date.now() + followingEvent.delay_horas * 3600000).toISOString()
      : null;

    // Update envio
    const { error: uErr } = await supabase
      .from("envios")
      .update({
        ultimo_evento_ordem: nextEvent.ordem,
        status: newStatus,
        status_label: nextEvent.status_label,
        proximo_avanco_em: proximoAvancoEm,
      })
      .eq("id", envioId);

    if (uErr) {
      console.error(`Failed to update envio ${envioId}:`, uErr);
      return false;
    }

    // Check if this event should send email
    let isAtivo = false;
    if (nextEvent.enviar_nfe_pdf) {
      isAtivo = config.enviar_nfe_email;
    } else if (nextEvent.status_label === "Taxação" || nextEvent.status_label === "Pago") {
      isAtivo = config.ativar_taxacao;
    } else {
      isAtivo = config.enviar_emails;
    }

    // Send email (skip NF-e PDF in cron — requires browser DOM)
    if (isAtivo && nextEvent.enviar_email) {
      console.log(`Sending email for envio ${envioId}, event: ${nextEvent.nome}`);
      const { error: funcErr } = await supabase.functions.invoke("send-email", {
        body: {
          envio_id: envioId,
          evento_id: nextEvent.id,
          loja_id: lojaId,
          nfe_storage_path: "",
          nfe_filename: "",
        },
      });
      if (funcErr) {
        console.error(`Email failed for envio ${envioId}:`, funcErr);
      }
    }

    // SMS dispatch
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

        if (smsDebitErr || !smsDebitOk) {
          canSendSms = false;
        }
      }

      if (canSendSms) {
        const { error: smsErr } = await supabase.functions.invoke("send-sms", {
          body: { envio_id: envioId, loja_id: lojaId, status_label: nextEvent.status_label },
        });
        if (smsErr) console.error(`SMS failed for envio ${envioId}:`, smsErr);
      }
    }

    console.log(`Advanced envio ${envioId} -> ${nextEvent.status_label} (${newStatus})`);
    return true;
  } catch (err) {
    console.error(`Error advancing envio ${envioId}:`, err);
    return false;
  }
}
