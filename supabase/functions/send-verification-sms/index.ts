import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string): string {
  return String(phone ?? "").replace(/\D/g, "");
}

function normalizeEmail(email: string): string {
  return String(email ?? "").trim().toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, email, full_name, skip_email_check } = await req.json();
    const normalizedPhone = normalizePhone(phone);
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedPhone || !normalizedEmail || !full_name) {
      return new Response(
        JSON.stringify({ error: "phone, email e full_name são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Rate limiting: max 3 attempts per phone in 10 minutes
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("signup_verifications")
      .select("*", { count: "exact", head: true })
      .eq("phone", normalizedPhone)
      .gte("created_at", tenMinAgo);

    if ((count || 0) >= 3) {
      return new Response(
        JSON.stringify({ error: "Muitas tentativas. Aguarde 10 minutos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if email already registered in auth (skip for existing users verifying)
    if (!skip_email_check) {
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const emailExists = existingUsers?.users?.some(
        (u) => normalizeEmail(u.email || "") === normalizedEmail
      );
      if (emailExists) {
        return new Response(
          JSON.stringify({ error: "Este email já está cadastrado. Faça login." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));

    // Save to DB — non-expiring codes for existing users (skip_email_check flow)
    const expiresAt = skip_email_check
      ? new Date("2099-12-31T23:59:59Z").toISOString()
      : new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: insertErr } = await supabase
      .from("signup_verifications")
      .insert({
        phone,
        email,
        full_name,
        code,
        status: "pendente",
        expires_at: expiresAt,
      });

    if (insertErr) {
      console.error("Insert error:", insertErr);
      throw new Error("Erro ao salvar verificação");
    }

    // Send via WhatsApp (UAZAPI) — primary channel
    const formattedPhone = formatPhone(phone);

    try {
      const { data: uazapiRows } = await supabase
        .from("system_config")
        .select("key, text_value")
        .in("key", ["verificacao_whatsapp_token", "verificacao_whatsapp_template"]);

      const configMap: Record<string, string | null> = {};
      uazapiRows?.forEach((r: any) => { configMap[r.key] = r.text_value; });

      const uazapiToken = configMap["verificacao_whatsapp_token"];
      const template = configMap["verificacao_whatsapp_template"] || "{{codigo}} - Use este código para confirmar seu cadastro. Válido por 10 min.";

      if (uazapiToken) {
        const whatsMessage = template.replace(/\{\{codigo\}\}/gi, code);
        console.log("Sending verification WhatsApp to:", formattedPhone);
        const whatsRes = await fetch("https://rushsend.uazapi.com/send/text", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            token: uazapiToken,
          },
          body: JSON.stringify({
            number: formattedPhone,
            text: whatsMessage,
          }),
        });
        console.log("WhatsApp API response:", whatsRes.status, await whatsRes.text());
      }
    } catch (whatsErr) {
      console.error("WhatsApp send failed (non-blocking):", whatsErr);
    }

    // Also send SMS as fallback for Brazilian numbers
    if (formattedPhone.startsWith("55")) {
      try {
        const token = Deno.env.get("INTEGRAX_API_KEY")!;
        const message = `${code} - Use este codigo para confirmar seu cadastro. Valido por 10 min.`;

        console.log("Sending verification SMS to:", formattedPhone);

        const smsResponse = await fetch(
          `https://sms.aresfun.com/v1/integration/${token}/send-sms`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: [formattedPhone],
              from: "29094",
              message,
            }),
          }
        );

        const smsResult = await smsResponse.text();
        console.log("SMS API response:", smsResponse.status, smsResult);
      } catch (smsErr) {
        console.error("SMS send failed (non-blocking):", smsErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Código enviado" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-verification-sms:", error);
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
