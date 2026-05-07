import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Admin verification
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleData } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { hours = 8, dry_run = false } = await req.json().catch(() => ({}));
    const sinceISO = new Date(Date.now() - hours * 3600 * 1000).toISOString();
    const untilISO = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // ignore last 5 min

    // Fetch envios that advanced but have no email log near updated_at
    const PAGE = 1000;
    let offset = 0;
    const candidates: any[] = [];
    while (true) {
      const { data, error } = await supabase
        .from("envios")
        .select("id, loja_id, postagem_template_id, ultimo_evento_ordem, updated_at, cliente_email")
        .is("deleted_at", null)
        .not("status_label", "is", null)
        .not("cliente_email", "is", null)
        .neq("cliente_email", "")
        .gte("updated_at", sinceISO)
        .lt("updated_at", untilISO)
        .order("updated_at", { ascending: false })
        .range(offset, offset + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      candidates.push(...data);
      if (data.length < PAGE) break;
      offset += PAGE;
    }

    // Filter out those that already have an email log around updated_at
    const ids = candidates.map((c) => c.id);
    const haveLog = new Set<string>();
    for (let i = 0; i < ids.length; i += 500) {
      const slice = ids.slice(i, i + 500);
      const { data: logs } = await supabase
        .from("postagem_email_log")
        .select("envio_id, created_at")
        .in("envio_id", slice)
        .gte("created_at", sinceISO);
      for (const l of logs || []) {
        const env = candidates.find((c) => c.id === l.envio_id);
        if (env && Math.abs(new Date(l.created_at).getTime() - new Date(env.updated_at).getTime()) < 10 * 60 * 1000) {
          haveLog.add(l.envio_id);
        }
      }
    }

    const pending = candidates.filter((c) => !haveLog.has(c.id));

    // Cache postagem_config + eventos per loja+template
    const configCache: Record<string, any> = {};
    const eventsCache: Record<string, any[]> = {};

    let dispatched = 0;
    let skipped = 0;
    let failed = 0;
    const errors: any[] = [];

    if (dry_run) {
      return new Response(JSON.stringify({
        dry_run: true,
        total_candidates: candidates.length,
        pending: pending.length,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    for (const env of pending) {
      try {
        // get config
        let config = configCache[env.loja_id];
        if (!config) {
          const { data: cfg } = await supabase
            .from("postagem_config").select("*").eq("loja_id", env.loja_id).maybeSingle();
          configCache[env.loja_id] = cfg;
          config = cfg;
        }
        if (!config?.enviar_emails) { skipped++; continue; }

        const tplId = env.postagem_template_id || config.template_ativo_id;
        if (!tplId) { skipped++; continue; }

        let events = eventsCache[tplId];
        if (!events) {
          const { data: ev } = await supabase
            .from("postagem_eventos").select("*").eq("template_id", tplId).order("ordem");
          events = ev || [];
          eventsCache[tplId] = events;
        }

        const evt = events.find((e) => e.ordem === env.ultimo_evento_ordem);
        if (!evt || !evt.enviar_email) { skipped++; continue; }

        const { error: invErr } = await supabase.functions.invoke("send-email", {
          body: {
            envio_id: env.id,
            evento_id: evt.id,
            loja_id: env.loja_id,
            skip_debit: true,
          },
        });
        if (invErr) {
          failed++;
          errors.push({ envio_id: env.id, error: String(invErr) });
        } else {
          dispatched++;
        }
        // throttle
        await new Promise((r) => setTimeout(r, 50));
      } catch (e: any) {
        failed++;
        errors.push({ envio_id: env.id, error: e.message });
      }
    }

    return new Response(JSON.stringify({
      total_candidates: candidates.length,
      pending: pending.length,
      dispatched, skipped, failed,
      errors: errors.slice(0, 20),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
