// Bulk send the email for a given status/ordem WITHOUT advancing the shipment.
// Auth: requires service-role bearer token (admin-only execution).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Body {
  loja_id: string;
  evento_id: string;
  status_label: string;
  ultimo_evento_ordem: number;
  batch_size?: number;
  pause_ms?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ── Auth: service-role OR authenticated owner of the loja ──
    const auth = req.headers.get("authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    const isServiceRole = token === SERVICE_ROLE;

    let authedUserId: string | null = null;
    if (!isServiceRole) {
      if (!token) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: userData } = await userClient.auth.getUser();
      if (!userData?.user?.id) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      authedUserId = userData.user.id;
    }


    const body = (await req.json()) as Body;
    const { loja_id, evento_id, status_label, ultimo_evento_ordem } = body;
    if (!loja_id || !evento_id || !status_label || typeof ultimo_evento_ordem !== "number") {
      return new Response(
        JSON.stringify({ error: "missing required fields: loja_id, evento_id, status_label, ultimo_evento_ordem" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const batchSize = Math.max(1, Math.min(20, body.batch_size ?? 8));
    const pauseMs = Math.max(0, body.pause_ms ?? 250);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Ownership check for non-service-role callers
    if (!isServiceRole && authedUserId) {
      const { data: ownsLoja } = await supabase.rpc("user_owns_loja", {
        _user_id: authedUserId,
        _loja_id: loja_id,
      });
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: authedUserId,
        _role: "admin",
      });
      if (!ownsLoja && !isAdmin) {
        return new Response(JSON.stringify({ error: "forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch all matching envios for this loja/status
    const { data: envios, error: eErr } = await supabase
      .from("envios")
      .select("id")
      .eq("loja_id", loja_id)
      .is("deleted_at", null)
      .eq("ultimo_evento_ordem", ultimo_evento_ordem)
      .eq("status_label", status_label);

    if (eErr) {
      return new Response(JSON.stringify({ error: eErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ids = (envios || []).map((e) => e.id as string);
    const total = ids.length;
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const failures: { envio_id: string; error: string }[] = [];

    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (envio_id) => {
          const { data, error } = await supabase.functions.invoke("send-email", {
            body: { envio_id, evento_id, loja_id },
          });
          if (error) throw new Error(error.message || String(error));
          return data;
        }),
      );
      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        if (r.status === "fulfilled") {
          // send-email returns { skipped: true } when already sent
          // deno-lint-ignore no-explicit-any
          if ((r.value as any)?.skipped) skipped++;
          else sent++;
        } else {
          failed++;
          failures.push({ envio_id: batch[j], error: r.reason?.message || String(r.reason) });
        }
      }
      if (i + batchSize < ids.length && pauseMs > 0) {
        await new Promise((res) => setTimeout(res, pauseMs));
      }
    }

    return new Response(
      JSON.stringify({
        total,
        sent,
        skipped,
        failed,
        failures: failures.slice(0, 20), // cap log
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
