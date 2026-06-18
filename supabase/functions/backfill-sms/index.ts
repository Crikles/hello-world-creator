import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Backfill SMS: re-dispara SMS para envios que avançaram de etapa e não tiveram SMS enviado.
// Body: { loja_id?: uuid, hours?: number (default 72), max?: number (default 500), dry_run?: boolean }
// Requer admin. Filtra: lojas com ativar_site_rastreio = true, envios c/ telefone, evento atual não-NFe,
// e que NÃO tenham registro 'sent' em sms_log para (envio_id, evento_id) atual.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth: requer admin
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "missing token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: userData } = await supabase.auth.getUser(token);
    const uid = userData?.user?.id;
    if (!uid) {
      return new Response(JSON.stringify({ error: "invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const targetLoja: string | undefined = body.loja_id;
    const hours: number = Math.min(Math.max(Number(body.hours) || 72, 1), 24 * 30);
    const maxEnvios: number = Math.min(Math.max(Number(body.max) || 500, 1), 2000);
    const dryRun: boolean = !!body.dry_run;

    // Lojas alvo
    const lojasQ = supabase.from("postagem_config").select("loja_id").eq("ativar_site_rastreio", true);
    if (targetLoja) lojasQ.eq("loja_id", targetLoja);
    const { data: lojas, error: lojasErr } = await lojasQ;
    if (lojasErr) throw lojasErr;
    const lojaIds = (lojas || []).map((l: any) => l.loja_id);
    if (lojaIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "nenhuma loja elegível", lojas: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Envios candidatos
    const since = new Date(Date.now() - hours * 3600_000).toISOString();
    const { data: envios, error: envErr } = await supabase
      .from("envios")
      .select("id, loja_id, cliente_telefone, ultimo_evento_ordem, status_label, created_at")
      .in("loja_id", lojaIds)
      .gt("ultimo_evento_ordem", 0)
      .not("cliente_telefone", "is", null)
      .gte("created_at", since)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(maxEnvios);
    if (envErr) throw envErr;

    const summary = {
      lojas_alvo: lojaIds.length,
      envios_candidatos: (envios || []).length,
      disparados: 0,
      ja_enviados: 0,
      sem_evento: 0,
      nfe_pulado: 0,
      falhas: 0,
      detalhes: [] as any[],
    };

    // Cache de eventos por template/loja
    const eventosCache = new Map<string, any[]>();

    for (const envio of envios || []) {
      const lojaId = envio.loja_id;
      // Buscar evento atual (ordem = ultimo_evento_ordem) — pega da loja ou template default
      let evts = eventosCache.get(lojaId);
      if (!evts) {
        const { data: evLoja } = await supabase
          .from("postagem_eventos").select("id, ordem, nome, status_label, enviar_nfe_pdf")
          .eq("loja_id", lojaId).order("ordem");
        if (evLoja && evLoja.length > 0) {
          evts = evLoja;
        } else {
          const { data: evTpl } = await supabase
            .from("postagem_eventos").select("id, ordem, nome, status_label, enviar_nfe_pdf")
            .is("loja_id", null).order("ordem");
          evts = evTpl || [];
        }
        eventosCache.set(lojaId, evts);
      }

      const ev = evts.find((e: any) => e.ordem === envio.ultimo_evento_ordem);
      if (!ev) { summary.sem_evento++; continue; }
      if (ev.enviar_nfe_pdf) { summary.nfe_pulado++; continue; }

      // Já enviou?
      const { data: existing } = await supabase
        .from("sms_log").select("id")
        .eq("envio_id", envio.id).eq("evento_id", ev.id).eq("status", "sent").limit(1);
      if (existing && existing.length > 0) { summary.ja_enviados++; continue; }

      summary.detalhes.push({ envio_id: envio.id, loja_id: lojaId, evento: ev.status_label, ordem: ev.ordem, telefone: envio.cliente_telefone });

      if (dryRun) continue;

      const { data: smsRes, error: smsErr } = await supabase.functions.invoke("send-sms", {
        body: { envio_id: envio.id, loja_id: lojaId, status_label: ev.status_label },
      });

      if (smsErr) {
        summary.falhas++;
        await supabase.from("sms_log").insert({
          envio_id: envio.id, loja_id: lojaId, evento_id: ev.id, status_label: ev.status_label,
          status: "failed", motivo: `backfill: ${String(smsErr?.message || smsErr)}`,
          telefone: envio.cliente_telefone, custo: 0, provider_response: smsRes ?? null,
        });
      } else {
        summary.disparados++;
        await supabase.from("sms_log").insert({
          envio_id: envio.id, loja_id: lojaId, evento_id: ev.id, status_label: ev.status_label,
          status: "sent", motivo: "backfill", telefone: envio.cliente_telefone,
          custo: 0, provider_response: smsRes ?? null,
        });
      }

      await new Promise((r) => setTimeout(r, 200));
    }

    return new Response(JSON.stringify({ ok: true, dry_run: dryRun, hours, ...summary }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("backfill-sms error:", err);
    return new Response(JSON.stringify({ error: String((err as Error)?.message || err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
