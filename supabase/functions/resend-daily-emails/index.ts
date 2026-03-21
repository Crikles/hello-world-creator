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

    // mode "failed" targets failed/bounced emails; default targets "sent" (original behavior)
    const statusFilter = mode === "failed" ? ["failed", "bounced"] : ["sent"];

    // Get today's start in UTC
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // Fetch ALL matching emails today with pagination
    const PAGE_SIZE = 1000;
    let allLogs: { envio_id: string; evento_id: string; loja_id: string }[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: logs, error: logErr } = await supabase
        .from("postagem_email_log")
        .select("envio_id, evento_id, loja_id")
        .gte("created_at", todayISO)
        .in("status", statusFilter)
        .not("envio_id", "is", null)
        .not("evento_id", "is", null)
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

    // Deduplicate by envio_id + evento_id
    const seen = new Set<string>();
    const unique = allLogs.filter((l) => {
      const key = `${l.envio_id}_${l.evento_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (dry_run) {
      return new Response(JSON.stringify({ total: unique.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let success = 0;
    let failed = 0;

    for (const log of unique) {
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            envio_id: log.envio_id,
            evento_id: log.evento_id,
            loja_id: log.loja_id,
          }),
        });

        if (resp.ok) {
          success++;
        } else {
          console.error(`Failed for envio ${log.envio_id}: ${resp.status}`);
          failed++;
        }
      } catch (e) {
        console.error(`Error for envio ${log.envio_id}:`, e);
        failed++;
      }

      // Rate limit delay
      await new Promise((r) => setTimeout(r, 500));
    }

    return new Response(
      JSON.stringify({ total: unique.length, success, failed }),
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
