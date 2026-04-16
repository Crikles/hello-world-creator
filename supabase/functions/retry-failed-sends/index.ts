import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SALDO_KEYWORDS = ["saldo", "insufficient", "insuficiente"];
const WINDOW_HOURS = 72;
const MAX_RETRIES = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    let { loja_id, user_id } = body as { loja_id?: string; user_id?: string };

    // If called from the client with JWT, identify user
    const authHeader = req.headers.get("authorization") || "";
    if (!user_id && authHeader && authHeader !== `Bearer ${anonKey}`) {
      const supabaseAuth = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await supabaseAuth.auth.getUser();
      if (user) user_id = user.id;
    }

    if (!loja_id && !user_id) {
      return new Response(
        JSON.stringify({ error: "loja_id ou user_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Resolve target lojas
    let lojaIds: string[] = [];
    if (loja_id) {
      lojaIds = [loja_id];
    } else if (user_id) {
      const { data: lojas } = await supabase
        .from("lojas")
        .select("id")
        .eq("user_id", user_id);
      lojaIds = (lojas || []).map((l: any) => l.id);
    }

    if (lojaIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Nenhuma loja encontrada", whatsapp: 0, confirmacao: 0, envios: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate balance for at least one loja owner (skip if zero to avoid loops)
    const { data: lojaOwners } = await supabase
      .from("lojas")
      .select("user_id")
      .in("id", lojaIds);
    const ownerIds = Array.from(new Set((lojaOwners || []).map((l: any) => l.user_id)));
    const { data: credits } = await supabase
      .from("creditos")
      .select("user_id, saldo")
      .in("user_id", ownerIds);
    const totalSaldo = (credits || []).reduce((sum: number, c: any) => sum + Number(c.saldo || 0), 0);

    if (totalSaldo <= 0) {
      return new Response(
        JSON.stringify({ success: false, message: "Saldo insuficiente para reprocessar", whatsapp: 0, confirmacao: 0, envios: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cutoff = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString();
    const orFilter = SALDO_KEYWORDS.map((k) => `error_reason.ilike.%${k}%`).join(",");

    // 1) Re-queue WhatsApp items
    const { data: waItems } = await supabase
      .from("whatsapp_send_queue")
      .select("id, retry_count")
      .in("loja_id", lojaIds)
      .eq("status", "failed")
      .gte("created_at", cutoff)
      .or(orFilter)
      .lt("retry_count", MAX_RETRIES);

    let whatsappCount = 0;
    if (waItems && waItems.length > 0) {
      const ids = waItems.map((i: any) => i.id);
      const { error: upErr } = await supabase
        .from("whatsapp_send_queue")
        .update({
          status: "pending",
          scheduled_at: new Date().toISOString(),
          error_reason: null,
          processed_at: null,
        })
        .in("id", ids);
      if (!upErr) whatsappCount = ids.length;
    }

    // 2) Re-dispatch payment confirmations (deduplicate by pedido_id)
    const { data: confItems } = await supabase
      .from("confirmacao_pagamento_log")
      .select("id, pedido_id, tipo")
      .in("loja_id", lojaIds)
      .eq("status", "failed")
      .gte("created_at", cutoff)
      .or(orFilter)
      .not("pedido_id", "is", null);

    const seenPedidos = new Set<string>();
    const pedidosToRetry: string[] = [];
    for (const item of confItems || []) {
      const key = `${item.pedido_id}`;
      if (!seenPedidos.has(key)) {
        seenPedidos.add(key);
        pedidosToRetry.push(item.pedido_id);
      }
    }

    let confirmacaoCount = 0;
    for (const pedidoId of pedidosToRetry) {
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/send-payment-confirmation`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ pedido_id: pedidoId, retry: true }),
        });
        if (resp.ok) confirmacaoCount++;
      } catch (err) {
        console.error("Retry confirmacao error:", pedidoId, err);
      }
    }

    // 3) Force shipment advancement: mark proximo_avanco_em = now()
    const { count: enviosCount, error: envErr } = await supabase
      .from("envios")
      .update({ proximo_avanco_em: new Date().toISOString() }, { count: "exact" })
      .in("loja_id", lojaIds)
      .lte("proximo_avanco_em", new Date().toISOString())
      .is("deleted_at", null);

    const enviosUpdated = envErr ? 0 : (enviosCount || 0);

    // Trigger advance-shipments for immediate processing (fire-and-forget)
    fetch(`${supabaseUrl}/functions/v1/advance-shipments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ trigger: "retry-failed-sends" }),
    }).catch((err) => console.error("advance-shipments dispatch error:", err));

    console.log(`Retry-failed-sends: lojas=${lojaIds.length} wa=${whatsappCount} conf=${confirmacaoCount} envios=${enviosUpdated}`);

    return new Response(
      JSON.stringify({
        success: true,
        whatsapp: whatsappCount,
        confirmacao: confirmacaoCount,
        envios: enviosUpdated,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("retry-failed-sends error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
