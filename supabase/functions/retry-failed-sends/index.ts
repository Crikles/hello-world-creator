import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SALDO_KEYWORDS = ["saldo", "insufficient", "insuficiente"];
const WINDOW_HOURS = 72;
const MAX_RETRIES = 3;
const BATCH_DELAY_MS = 350; // delay entre cada chamada para evitar rate-limit
const MAX_RETRY_ON_RATELIMIT = 3;

// Lock em memória por loja_id — impede que duplo clique processe 2x ao mesmo tempo
const activeLocks = new Set<string>();

declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void };

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Reenvia 1 confirmação com retry automático em rate-limit.
 */
async function dispatchConfirmacaoWithRetry(
  supabaseUrl: string,
  serviceRoleKey: string,
  pedidoId: string,
): Promise<boolean> {
  for (let attempt = 0; attempt < MAX_RETRY_ON_RATELIMIT; attempt++) {
    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/send-payment-confirmation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ pedido_id: pedidoId, retry: true }),
      });
      if (resp.ok) return true;
      // 429 = rate limit
      if (resp.status === 429) {
        const retryAfter = Number(resp.headers.get("retry-after") || "5");
        console.log(`Rate-limit em ${pedidoId}, aguardando ${retryAfter}s (tentativa ${attempt + 1})`);
        await sleep(retryAfter * 1000 + 500);
        continue;
      }
      // outro erro: loga e desiste
      const text = await resp.text().catch(() => "");
      console.error(`Falha ${resp.status} em ${pedidoId}: ${text.slice(0, 200)}`);
      return false;
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (msg.includes("Rate limit") || msg.includes("RateLimit")) {
        const m = msg.match(/Retry after (\d+)ms/);
        const waitMs = m ? Number(m[1]) + 500 : 5000;
        console.log(`Rate-limit (catch) em ${pedidoId}, aguardando ${waitMs}ms`);
        await sleep(waitMs);
        continue;
      }
      console.error(`Erro inesperado em ${pedidoId}:`, msg);
      return false;
    }
  }
  return false;
}

/**
 * Processa o reenvio em background.
 */
async function processInBackground(opts: {
  supabaseUrl: string;
  serviceRoleKey: string;
  lojaIds: string[];
}) {
  const { supabaseUrl, serviceRoleKey, lojaIds } = opts;
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const cutoff = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const orFilter = SALDO_KEYWORDS.map((k) => `error_reason.ilike.%${k}%`).join(",");

  try {
    // 1) Re-enfileirar WhatsApp (operação em massa, sem rate-limit)
    const { data: waItems } = await supabase
      .from("whatsapp_send_queue")
      .select("id")
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

    // 2) Re-disparar confirmações de pagamento (deduplicado por pedido_id)
    const { data: confItems } = await supabase
      .from("confirmacao_pagamento_log")
      .select("id, pedido_id")
      .in("loja_id", lojaIds)
      .eq("status", "failed")
      .gte("created_at", cutoff)
      .or(orFilter)
      .not("pedido_id", "is", null);

    const pedidosToRetry = Array.from(
      new Set((confItems || []).map((i: any) => i.pedido_id as string)),
    );

    let confirmacaoOk = 0;
    let confirmacaoFail = 0;
    for (const pedidoId of pedidosToRetry) {
      const ok = await dispatchConfirmacaoWithRetry(supabaseUrl, serviceRoleKey, pedidoId);
      if (ok) confirmacaoOk++;
      else confirmacaoFail++;
      // throttle entre cada chamada para evitar bater rate-limit
      await sleep(BATCH_DELAY_MS);
    }

    // 3) Forçar avanço de envios
    await supabase
      .from("envios")
      .update({ proximo_avanco_em: new Date().toISOString() })
      .in("loja_id", lojaIds)
      .lte("proximo_avanco_em", new Date().toISOString())
      .is("deleted_at", null);

    // 4) Disparar advance-shipments (com retry simples para rate-limit)
    for (let i = 0; i < 2; i++) {
      try {
        const r = await fetch(`${supabaseUrl}/functions/v1/advance-shipments`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ trigger: "retry-failed-sends" }),
        });
        if (r.status !== 429) break;
        await sleep(5000);
      } catch (err) {
        console.error("advance-shipments dispatch error:", err);
        break;
      }
    }

    console.log(
      `[retry-failed-sends] BG done lojas=${lojaIds.length} wa=${whatsappCount} confOk=${confirmacaoOk} confFail=${confirmacaoFail}`,
    );
  } catch (err) {
    console.error("[retry-failed-sends] background error:", err);
  } finally {
    // libera locks
    for (const id of lojaIds) activeLocks.delete(id);
  }
}

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

    // Identifica usuário pelo JWT se vier do frontend
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

    // Resolve lojas
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
        JSON.stringify({ success: true, message: "Nenhuma loja encontrada", queued: 0, alreadyRunning: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // GUARD: já existe processamento em andamento? evita duplo clique gastar 2x
    const alreadyRunning = lojaIds.some((id) => activeLocks.has(id));
    if (alreadyRunning) {
      console.log("[retry-failed-sends] Reenvio já em andamento, ignorando duplo clique:", lojaIds);
      return new Response(
        JSON.stringify({
          success: true,
          alreadyRunning: true,
          message: "Reenvio já está em andamento. Aguarde a conclusão.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Valida saldo antes de iniciar (evita loop sem efeito)
    const { data: lojaOwners } = await supabase
      .from("lojas")
      .select("user_id")
      .in("id", lojaIds);
    const ownerIds = Array.from(new Set((lojaOwners || []).map((l: any) => l.user_id)));
    const { data: credits } = await supabase
      .from("creditos")
      .select("user_id, saldo")
      .in("user_id", ownerIds);
    const totalSaldo = (credits || []).reduce(
      (sum: number, c: any) => sum + Number(c.saldo || 0),
      0,
    );

    if (totalSaldo <= 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Saldo insuficiente para reprocessar",
          queued: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Conta itens pendentes para devolver na resposta
    const cutoff = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString();
    const orFilter = SALDO_KEYWORDS.map((k) => `error_reason.ilike.%${k}%`).join(",");

    const { count: queuedCount } = await supabase
      .from("confirmacao_pagamento_log")
      .select("id", { count: "exact", head: true })
      .in("loja_id", lojaIds)
      .eq("status", "failed")
      .gte("created_at", cutoff)
      .or(orFilter);

    // ADQUIRE LOCK e dispara em background
    for (const id of lojaIds) activeLocks.add(id);

    EdgeRuntime.waitUntil(
      processInBackground({ supabaseUrl, serviceRoleKey, lojaIds }),
    );

    console.log(
      `[retry-failed-sends] Aceito em background: lojas=${lojaIds.length} pendentes=${queuedCount}`,
    );

    // Resposta imediata: garante que o usuário não fica esperando e não dispara 2x
    return new Response(
      JSON.stringify({
        success: true,
        accepted: true,
        queued: queuedCount || 0,
        message: "Reenvio iniciado em segundo plano. Acompanhe pelo histórico.",
      }),
      { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("retry-failed-sends error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
