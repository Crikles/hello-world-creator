import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify admin
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { dry_run, mode } = await req.json().catch(() => ({ dry_run: false, mode: "sent" }));

    const statusFilter = mode === "failed" ? ["failed", "bounced"] : ["sent"];

    // Get today's start in UTC
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // Fetch ALL matching emails today with pagination
    const PAGE_SIZE = 1000;
    let allLogs: { envio_id: string; evento_id: string; loja_id: string; destinatario: string; created_at: string; status: string }[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: logs, error: logErr } = await supabase
        .from("postagem_email_log")
        .select("envio_id, evento_id, loja_id, destinatario, created_at, status")
        .gte("created_at", todayISO)
        .in("status", statusFilter)
        .not("envio_id", "is", null)
        .not("evento_id", "is", null)
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (logErr) throw logErr;

      if (logs && logs.length > 0) {
        allLogs = allLogs.concat(logs);
        offset += PAGE_SIZE;
        hasMore = logs.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }

    // For "failed" mode: smart dedup — only keep the LATEST record per envio_id+evento_id
    // and only if that latest status is still failed/bounced
    // Also limit to max 2 retry attempts per destinatario per day
    let toResend: { envio_id: string; evento_id: string; loja_id: string; destinatario: string }[] = [];

    if (mode === "failed") {
      // Get ALL logs for today (including successful ones) to check latest status
      let allTodayLogs: { envio_id: string; evento_id: string; status: string; created_at: string; destinatario: string; loja_id: string }[] = [];
      let offset2 = 0;
      let hasMore2 = true;

      while (hasMore2) {
        const { data: logs2, error: logErr2 } = await supabase
          .from("postagem_email_log")
          .select("envio_id, evento_id, status, created_at, destinatario, loja_id")
          .gte("created_at", todayISO)
          .not("envio_id", "is", null)
          .not("evento_id", "is", null)
          .order("created_at", { ascending: false })
          .range(offset2, offset2 + PAGE_SIZE - 1);

        if (logErr2) throw logErr2;

        if (logs2 && logs2.length > 0) {
          allTodayLogs = allTodayLogs.concat(logs2);
          offset2 += PAGE_SIZE;
          hasMore2 = logs2.length === PAGE_SIZE;
        } else {
          hasMore2 = false;
        }
      }

      // Group by envio_id+evento_id, get latest status
      const latestByKey = new Map<string, { envio_id: string; evento_id: string; loja_id: string; destinatario: string; status: string; failCount: number }>();

      for (const log of allTodayLogs) {
        const key = `${log.envio_id}_${log.evento_id}`;
        if (!latestByKey.has(key)) {
          // First entry is latest (ordered by created_at DESC)
          latestByKey.set(key, {
            envio_id: log.envio_id,
            evento_id: log.evento_id,
            loja_id: log.loja_id,
            destinatario: log.destinatario,
            status: log.status,
            failCount: 0,
          });
        }
        // Count failed/bounced attempts
        if (log.status === "failed" || log.status === "bounced") {
          latestByKey.get(key)!.failCount++;
        }
      }

      // Count retries per destinatario today (max 2)
      const retriesByDestinatario = new Map<string, number>();

      for (const [, entry] of latestByKey) {
        // Only resend if latest status is still failed/bounced
        if (entry.status !== "failed" && entry.status !== "bounced") continue;

        // Max 2 attempts per destinatario per day
        const currentRetries = retriesByDestinatario.get(entry.destinatario) || 0;
        if (currentRetries >= 2) continue;

        retriesByDestinatario.set(entry.destinatario, currentRetries + 1);
        toResend.push({
          envio_id: entry.envio_id,
          evento_id: entry.evento_id,
          loja_id: entry.loja_id,
          destinatario: entry.destinatario,
        });
      }
    } else {
      // "sent" mode — original behavior with dedup
      const seen = new Set<string>();
      for (const log of allLogs) {
        const key = `${log.envio_id}_${log.evento_id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        toResend.push({
          envio_id: log.envio_id,
          evento_id: log.evento_id,
          loja_id: log.loja_id,
          destinatario: log.destinatario,
        });
      }
    }

    if (dry_run) {
      return new Response(JSON.stringify({ total: toResend.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let success = 0;
    let failed = 0;
    const results: { destinatario: string; envio_id: string; status: "ok" | "erro"; erro?: string }[] = [];

    for (const item of toResend) {
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            envio_id: item.envio_id,
            evento_id: item.evento_id,
            loja_id: item.loja_id,
          }),
        });

        if (resp.ok) {
          success++;
          results.push({ destinatario: item.destinatario, envio_id: item.envio_id, status: "ok" });
        } else {
          const errText = await resp.text().catch(() => "");
          console.error(`Failed for envio ${item.envio_id}: ${resp.status}`);
          failed++;
          results.push({ destinatario: item.destinatario, envio_id: item.envio_id, status: "erro", erro: `HTTP ${resp.status}` });
        }
      } catch (e) {
        console.error(`Error for envio ${item.envio_id}:`, e);
        failed++;
        results.push({ destinatario: item.destinatario, envio_id: item.envio_id, status: "erro", erro: (e as Error).message });
      }

      // Rate limit delay
      await new Promise((r) => setTimeout(r, 500));
    }

    return new Response(
      JSON.stringify({ total: toResend.length, success, failed, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("resend-daily-emails error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
