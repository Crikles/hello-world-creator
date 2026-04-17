import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Keywords that indicate a transient failure worth retrying.
// Includes saldo (our internal balance) AND provider-side credit errors.
const SALDO_KEYWORDS = [
  "saldo",
  "insufficient",
  "insuficiente",
  "credit_not_debited",
  "credit not debited",
];
const WINDOW_HOURS = 72;
const MAX_RETRIES = 3;
const BATCH_DELAY_MS = 350;
const MAX_RETRY_ON_RATELIMIT = 3;

declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void };

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function dispatchConfirmacaoWithRetry(
  supabaseUrl: string,
  serviceRoleKey: string,
  pedidoId: string,
  lojaId: string,
): Promise<boolean> {
  for (let attempt = 0; attempt < MAX_RETRY_ON_RATELIMIT; attempt++) {
    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/send-payment-confirmation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ pedido_id: pedidoId, loja_id: lojaId, retry: true }),
      });
      if (resp.ok) return true;
      if (resp.status === 429) {
        const retryAfter = Number(resp.headers.get("retry-after") || "5");
        await sleep(retryAfter * 1000 + 500);
        continue;
      }
      const text = await resp.text().catch(() => "");
      console.error(`Falha ${resp.status} em ${pedidoId}: ${text.slice(0, 200)}`);
      return false;
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (msg.includes("Rate limit") || msg.includes("RateLimit")) {
        const m = msg.match(/Retry after (\d+)ms/);
        const waitMs = m ? Number(m[1]) + 500 : 5000;
        await sleep(waitMs);
        continue;
      }
      console.error(`Erro inesperado em ${pedidoId}:`, msg);
      return false;
    }
  }
  return false;
}

async function processInBackground(opts: {
  supabaseUrl: string;
  serviceRoleKey: string;
  lojaIds: string[];
  execucaoId: string;
}) {
  const { supabaseUrl, serviceRoleKey, lojaIds, execucaoId } = opts;
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const cutoff = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const orFilter = SALDO_KEYWORDS.map((k) => `error_reason.ilike.%${k}%`).join(",");

  let sucesso = 0;
  let falhas = 0;
  let processados = 0;

  try {
    // 1) Re-enqueue WhatsApp
    const { data: waItems } = await supabase
      .from("whatsapp_send_queue")
      .select("id")
      .in("loja_id", lojaIds)
      .eq("status", "failed")
      .gte("created_at", cutoff)
      .or(orFilter)
      .lt("retry_count", MAX_RETRIES);

    if (waItems && waItems.length > 0) {
      const ids = waItems.map((i: any) => i.id);
      await supabase
        .from("whatsapp_send_queue")
        .update({
          status: "pending",
          scheduled_at: new Date().toISOString(),
          error_reason: null,
          processed_at: null,
        })
        .in("id", ids);
    }

    // 2) Re-dispatch payment confirmations
    // Strategy: fetch ALL "failed" logs (paginated to bypass 1000 limit),
    // then verify they're still the LATEST per (pedido, tipo) by checking
    // if any newer "sent" exists for the same key.
    const failedLogs: Array<{ pedido_id: string; loja_id: string; tipo: string; error_reason: string | null; created_at: string }> = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data: page, error: pageErr } = await supabase
        .from("confirmacao_pagamento_log")
        .select("pedido_id, loja_id, tipo, error_reason, created_at")
        .in("loja_id", lojaIds)
        .eq("status", "failed")
        .gte("created_at", cutoff)
        .not("pedido_id", "is", null)
        .order("created_at", { ascending: false })
        .range(from, from + PAGE - 1);
      if (pageErr) {
        console.error("[retry-failed-sends] page error:", pageErr);
        break;
      }
      if (!page || page.length === 0) break;
      failedLogs.push(...(page as any));
      if (page.length < PAGE) break;
    }

    // Keep latest failure per (pedido, tipo)
    const latestFailByKey = new Map<string, { pedidoId: string; lojaId: string; tipo: string; errorReason: string | null; createdAt: string }>();
    for (const f of failedLogs) {
      const key = `${f.pedido_id}::${f.tipo}`;
      const existing = latestFailByKey.get(key);
      if (!existing || f.created_at > existing.createdAt) {
        latestFailByKey.set(key, {
          pedidoId: f.pedido_id,
          lojaId: f.loja_id,
          tipo: f.tipo,
          errorReason: f.error_reason,
          createdAt: f.created_at,
        });
      }
    }

    // For each (pedido, tipo) failure, check if a NEWER "sent" exists
    const pedidoLojaMap = new Map<string, { lojaId: string; lastFailAt: string }>();
    for (const v of latestFailByKey.values()) {
      const reason = (v.errorReason || "").toLowerCase();
      const isRetryable = SALDO_KEYWORDS.some((k) => reason.includes(k)) || reason === "";
      if (!isRetryable) continue;

      const { data: newer } = await supabase
        .from("confirmacao_pagamento_log")
        .select("id")
        .eq("pedido_id", v.pedidoId)
        .eq("tipo", v.tipo)
        .eq("status", "sent")
        .gt("created_at", v.createdAt)
        .limit(1);
      if (newer && newer.length > 0) continue; // already succeeded later

      const existing = pedidoLojaMap.get(v.pedidoId);
      if (!existing || v.createdAt > existing.lastFailAt) {
        pedidoLojaMap.set(v.pedidoId, { lojaId: v.lojaId, lastFailAt: v.createdAt });
      }
    }

    const totalReal = pedidoLojaMap.size;

    // Update execução with the real total
    await supabase
      .from("retry_execucoes")
      .update({
        total_pendentes: totalReal,
        status: "running",
        updated_at: new Date().toISOString(),
      })
      .eq("id", execucaoId);

    for (const [pedidoId, info] of pedidoLojaMap) {
      const ok = await dispatchConfirmacaoWithRetry(
        supabaseUrl,
        serviceRoleKey,
        pedidoId,
        info.lojaId,
      );
      if (ok) sucesso++;
      else falhas++;
      processados++;

      // Update progress periodically (every 3 items or last)
      if (processados % 3 === 0 || processados === totalReal) {
        await supabase
          .from("retry_execucoes")
          .update({
            processados,
            sucesso,
            falhas,
            updated_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          })
          .eq("id", execucaoId);
      }

      await sleep(BATCH_DELAY_MS);
    }

    // 3) Force shipment advance
    await supabase
      .from("envios")
      .update({ proximo_avanco_em: new Date().toISOString() })
      .in("loja_id", lojaIds)
      .lte("proximo_avanco_em", new Date().toISOString())
      .is("deleted_at", null);

    // 4) Trigger advance-shipments
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

    // Mark execução as done
    await supabase
      .from("retry_execucoes")
      .update({
        status: "done",
        processados,
        sucesso,
        falhas,
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        mensagem: `Concluído: ${sucesso} OK, ${falhas} falhas`,
      })
      .eq("id", execucaoId);

    console.log(
      `[retry-failed-sends] BG done execId=${execucaoId} confOk=${sucesso} confFail=${falhas}`,
    );
  } catch (err) {
    console.error("[retry-failed-sends] background error:", err);
    await supabase
      .from("retry_execucoes")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        mensagem: String((err as any)?.message || err).slice(0, 500),
      })
      .eq("id", execucaoId);
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

    // PERSISTENT LOCK: check if there's an active execution for any loja
    const nowIso = new Date().toISOString();
    const { data: ativas } = await supabase
      .from("retry_execucoes")
      .select("id, loja_id, status, total_pendentes, processados")
      .in("loja_id", lojaIds)
      .in("status", ["queued", "running"])
      .gt("expires_at", nowIso);

    if (ativas && ativas.length > 0) {
      const ativa = ativas[0];
      console.log("[retry-failed-sends] já em andamento:", ativa.id);
      return new Response(
        JSON.stringify({
          success: true,
          alreadyRunning: true,
          execucao_id: ativa.id,
          processados: ativa.processados,
          total_pendentes: ativa.total_pendentes,
          message: "Reenvio já está em andamento. Aguarde a conclusão.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate balance
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

    // Estimate real pending pedidos: latest status per (pedido, tipo) = "failed"
    const cutoff = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString();
    const { data: estimateLogs } = await supabase
      .from("confirmacao_pagamento_log")
      .select("pedido_id, tipo, status, error_reason, created_at")
      .in("loja_id", lojaIds)
      .gte("created_at", cutoff)
      .not("pedido_id", "is", null)
      .order("created_at", { ascending: false });

    const seenLatest = new Set<string>();
    const pendingPedidos = new Set<string>();
    for (const l of estimateLogs || []) {
      const key = `${l.pedido_id}::${l.tipo}`;
      if (seenLatest.has(key)) continue;
      seenLatest.add(key);
      if (l.status !== "failed") continue;
      const reason = (l.error_reason || "").toLowerCase();
      const isRetryable = SALDO_KEYWORDS.some((k) => reason.includes(k)) || reason === "";
      if (isRetryable) pendingPedidos.add(l.pedido_id as string);
    }
    const queuedCount = pendingPedidos.size;

    // Acquire persistent lock by inserting an execution row
    const { data: execucao, error: execErr } = await supabase
      .from("retry_execucoes")
      .insert({
        loja_id: lojaIds[0],
        status: "queued",
        total_pendentes: queuedCount || 0,
        processados: 0,
        sucesso: 0,
        falhas: 0,
        mensagem: "Iniciando reenvio…",
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();

    if (execErr || !execucao) {
      console.error("Falha ao criar execução:", execErr);
      return new Response(
        JSON.stringify({ error: "Não foi possível iniciar reenvio" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    EdgeRuntime.waitUntil(
      processInBackground({
        supabaseUrl,
        serviceRoleKey,
        lojaIds,
        execucaoId: execucao.id,
      }),
    );

    console.log(
      `[retry-failed-sends] Aceito execId=${execucao.id} lojas=${lojaIds.length} pendentes=${queuedCount}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        accepted: true,
        execucao_id: execucao.id,
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
