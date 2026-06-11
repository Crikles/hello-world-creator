// One-shot admin tool: reenvia em lote o e-mail do evento atual
// para TODOS os envios de uma loja que estão em ordem >= 2 e não
// possuem nenhum registro com status='enviado' em postagem_email_log.
// Ignora a flag auto_envio (uso administrativo).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Auth: admin OR service-role token
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    let isServiceRole = token === serviceRoleKey;
    if (!isServiceRole) {
      try {
        const parts = token.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          if (payload?.role === "service_role") isServiceRole = true;
        }
      } catch { /* ignore */ }
    }
    if (!isServiceRole) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (!roleData) return new Response(JSON.stringify({ error: "Acesso negado" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { loja_id, dry_run = false, limit = 500, concurrency = 4, delay_ms = 1200 } = await req.json().catch(() => ({}));
    if (!loja_id) return new Response(JSON.stringify({ error: "loja_id obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Busca envios candidatos (paginado)
    const PAGE = 1000;
    const candidates: any[] = [];
    let offset = 0;
    while (candidates.length < limit + 50) {
      const { data, error } = await supabase
        .from("envios")
        .select("id, loja_id, postagem_template_id, ultimo_evento_ordem, cliente_email")
        .eq("loja_id", loja_id)
        .is("deleted_at", null)
        .gte("ultimo_evento_ordem", 2)
        .not("cliente_email", "is", null)
        .neq("cliente_email", "")
        .order("created_at", { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      candidates.push(...data);
      if (data.length < PAGE) break;
      offset += PAGE;
    }

    // Filtra os que NÃO têm log status='enviado'
    const ids = candidates.map((c) => c.id);
    const sent = new Set<string>();
    for (let i = 0; i < ids.length; i += 500) {
      const slice = ids.slice(i, i + 500);
      const { data: logs } = await supabase
        .from("postagem_email_log").select("envio_id").in("envio_id", slice).eq("status", "enviado");
      for (const l of logs || []) sent.add(l.envio_id);
    }
    const pending = candidates.filter((c) => !sent.has(c.id)).slice(0, limit);

    if (dry_run) {
      return new Response(JSON.stringify({ dry_run: true, total: candidates.length, pending: pending.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Cache config + eventos
    const { data: config } = await supabase.from("postagem_config").select("*").eq("loja_id", loja_id).maybeSingle();
    const eventsCache: Record<string, any[]> = {};

    let dispatched = 0, skipped = 0, failed = 0;
    const errors: any[] = [];

    async function processOne(env: any) {
      try {
        const tplId = env.postagem_template_id || config?.template_ativo_id;
        if (!tplId) { skipped++; return; }
        let events = eventsCache[tplId];
        if (!events) {
          const { data: ev } = await supabase.from("postagem_eventos").select("*").eq("template_id", tplId).order("ordem");
          events = ev || [];
          eventsCache[tplId] = events;
        }
        const evt = events.find((e) => e.ordem === env.ultimo_evento_ordem);
        if (!evt || !evt.enviar_email) { skipped++; return; }

        // Retry com backoff em caso de rate limit
        let attempt = 0;
        let lastErr: any = null;
        while (attempt < 4) {
          attempt++;
          const { error: invErr } = await supabase.functions.invoke("send-email", {
            body: { envio_id: env.id, evento_id: evt.id, loja_id: env.loja_id, skip_debit: true },
          });
          if (!invErr) { dispatched++; return; }
          lastErr = invErr;
          const msg = String(invErr?.message || invErr);
          if (/RateLimit|429/i.test(msg)) {
            const waitMs = Math.min(15000, 1500 * Math.pow(2, attempt - 1));
            await new Promise((r) => setTimeout(r, waitMs));
            continue;
          }
          break;
        }
        failed++;
        errors.push({ envio_id: env.id, error: String(lastErr?.message || lastErr) });
      } catch (e: any) {
        failed++;
        errors.push({ envio_id: env.id, error: e.message });
      }
    }

    for (let i = 0; i < pending.length; i += concurrency) {
      await Promise.all(pending.slice(i, i + concurrency).map(processOne));
      if (i + concurrency < pending.length) await new Promise((r) => setTimeout(r, delay_ms));
    }

    return new Response(JSON.stringify({
      total_candidates: candidates.length,
      pending: pending.length,
      dispatched, skipped, failed,
      errors: errors.slice(0, 30),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
