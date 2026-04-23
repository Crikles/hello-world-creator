import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Sends a one-time-per-day low-balance alert (email + WhatsApp via UAZAPI admin)
// Body: { user_id: string }
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Throttle: only one alert per user per 24h (marker stored in creditos_transacoes)
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data: recent } = await supabase
      .from("creditos_transacoes")
      .select("id")
      .eq("user_id", user_id)
      .like("descricao", "[ALERTA_SALDO_BAIXO]%")
      .gte("created_at", since)
      .limit(1);

    if (recent && recent.length > 0) {
      return new Response(JSON.stringify({ skipped: "already_sent_24h" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name, whatsapp")
      .eq("id", user_id)
      .single();

    const { data: cred } = await supabase
      .from("creditos")
      .select("saldo")
      .eq("user_id", user_id)
      .single();

    if (!profile?.email) {
      return new Response(JSON.stringify({ error: "no email" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nome = (profile.full_name || "").split(" ")[0] || "Cliente";
    const saldo = Number(cred?.saldo ?? 0).toFixed(2);

    // 1. Send email via Resend
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_API_KEY) {
      const html = `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb">
          <h2 style="color:#111;margin:0 0 12px">Olá, ${nome}!</h2>
          <p style="color:#374151;line-height:1.5">
            Seu saldo na <strong>Magnus</strong> está baixo: <strong>${saldo} moedas</strong>.
          </p>
          <p style="color:#374151;line-height:1.5">
            Para evitar interrupção nos disparos automáticos de e-mail, SMS e WhatsApp dos seus pedidos, recarregue agora:
          </p>
          <p style="text-align:center;margin:24px 0">
            <a href="https://magnusfrete.com/moedas" style="background:#000;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600">Recarregar Moedas</a>
          </p>
          <p style="color:#6b7280;font-size:13px">Você só receberá este aviso uma vez por dia.</p>
        </div>`;
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Magnus <noreply@jltransportes.pro>",
            to: [profile.email],
            subject: "⚠️ Saldo baixo — recarregue para não interromper seus disparos",
            html,
          }),
        });
      } catch (err) {
        console.error("low-balance email error:", err);
      }
    }

    // 2. Send WhatsApp via UAZAPI admin (best effort)
    const UAZAPI_TOKEN = Deno.env.get("UAZAPI_ADMIN_TOKEN");
    if (UAZAPI_TOKEN && profile.whatsapp) {
      try {
        const phone = profile.whatsapp.replace(/\D/g, "");
        const number = phone.length === 10 || phone.length === 11 ? `55${phone}` : phone;
        await fetch("https://rushsend.uazapi.com/send/text", {
          method: "POST",
          headers: { "Content-Type": "application/json", token: UAZAPI_TOKEN },
          body: JSON.stringify({
            number,
            text: `Olá ${nome}! Seu saldo na *Magnus* está baixo: *${saldo} moedas*. Recarregue em magnusfrete.com/moedas para não interromper seus disparos. 🚀`,
          }),
        });
      } catch (err) {
        console.error("low-balance whatsapp error:", err);
      }
    }

    // Mark sent (use 'adicao' with quantity 0 + tagged descricao as throttle marker)
    await supabase.from("creditos_transacoes").insert({
      user_id,
      tipo: "adicao",
      quantidade: 0,
      descricao: `[ALERTA_SALDO_BAIXO] Aviso automático de saldo baixo (saldo: ${saldo})`,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("low-balance-alert error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
