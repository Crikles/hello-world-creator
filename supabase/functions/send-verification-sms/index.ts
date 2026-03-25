import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function formatPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)\+\.]/g, "");
  if (cleaned.startsWith("55")) return cleaned;
  return "55" + cleaned;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, email, full_name } = await req.json();

    if (!phone || !email || !full_name) {
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
      .eq("phone", phone)
      .gte("created_at", tenMinAgo);

    if ((count || 0) >= 3) {
      return new Response(
        JSON.stringify({ error: "Muitas tentativas. Aguarde 10 minutos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if email already registered in auth
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.some(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (emailExists) {
      return new Response(
        JSON.stringify({ error: "Este email já está cadastrado. Faça login." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));

    // Save to DB
    const { error: insertErr } = await supabase
      .from("signup_verifications")
      .insert({
        phone,
        email,
        full_name,
        code,
        status: "pendente",
      });

    if (insertErr) {
      console.error("Insert error:", insertErr);
      throw new Error("Erro ao salvar verificação");
    }

    // Send SMS via IntegraX
    const token = Deno.env.get("INTEGRAX_API_KEY")!;
    const formattedPhone = formatPhone(phone);
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

    if (!smsResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Erro ao enviar SMS. Tente novamente.", details: smsResult }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Best-effort: also send via WhatsApp (UAZAPI) if configured
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

    return new Response(
      JSON.stringify({ success: true, message: "Código enviado por SMS" }),
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
