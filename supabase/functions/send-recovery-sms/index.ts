import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function removeAccents(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function formatPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)\+\.]/g, "");
  if (cleaned.startsWith("55")) return cleaned;
  return "55" + cleaned;
}

function hasSpecialChars(text: string): boolean {
  // Check for accents, emojis, or special chars after removeAccents
  const cleaned = removeAccents(text);
  // Only allow basic ASCII printable chars (space to ~)
  return /[^\x20-\x7E]/.test(cleaned);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lead_id, loja_id, tipo, customer_email } = await req.json();

    if (!loja_id || (!lead_id && !customer_email)) {
      return new Response(
        JSON.stringify({ error: "loja_id and (lead_id or customer_email) are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth: service-role OR loja owner / admin
    const { getAuthContext, userOwnsLoja, unauthorized, forbidden } = await import("../_shared/auth.ts");
    const auth = await getAuthContext(req);
    if (!auth.isServiceRole) {
      if (!auth.userId) return unauthorized();
      if (!auth.isAdmin && !(await userOwnsLoja(auth.userId, loja_id))) return forbidden();
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get lead data: either by id, or by latest matching email/loja/tipo
    let leadQuery = supabase
      .from("recovery_leads")
      .select("*")
      .eq("loja_id", loja_id);

    if (lead_id) {
      leadQuery = leadQuery.eq("id", lead_id);
    } else {
      leadQuery = leadQuery
        .eq("customer_email", customer_email)
        .eq("tipo", tipo || "carrinho")
        .order("created_at", { ascending: false })
        .limit(1);
    }

    const { data: lead, error: leadErr } = await leadQuery.maybeSingle();

    if (leadErr || !lead) {
      return new Response(
        JSON.stringify({ error: "Lead not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!lead.customer_phone) {
      return new Response(
        JSON.stringify({ error: "Lead sem telefone" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get recovery config for SMS template
    const { data: config } = await supabase
      .from("recovery_config")
      .select("*")
      .eq("loja_id", loja_id)
      .eq("tipo", tipo || "carrinho")
      .maybeSingle();

    if (!config || !config.enviar_sms) {
      return new Response(
        JSON.stringify({ ok: false, message: "SMS not active for this tipo" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const smsTemplate = config.sms_template || "";
    if (!smsTemplate) {
      return new Response(
        JSON.stringify({ ok: false, message: "No SMS template configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get loja for user_id (credit debit)
    const { data: loja } = await supabase
      .from("lojas")
      .select("user_id")
      .eq("id", loja_id)
      .maybeSingle();

    if (!loja) {
      return new Response(
        JSON.stringify({ error: "Loja not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch dynamic cost: custom_prices > system_config > fallback
    const configKey = `custo_recovery_sms_${tipo || "carrinho"}`;
    let custo = 0.15; // fallback

    const { data: sysConf } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", configKey)
      .maybeSingle();
    if (sysConf) custo = sysConf.value;

    const { data: profile } = await supabase
      .from("profiles")
      .select("custom_prices")
      .eq("id", loja.user_id)
      .maybeSingle();
    const customPrices = (profile?.custom_prices || {}) as Record<string, number>;
    if (typeof customPrices[configKey] === "number") custo = customPrices[configKey];

    // Build variables
    const firstName = (lead.customer_name || "").split(" ")[0];
    const products = (lead.products || []) as { name: string }[];
    const produtoNome = products.length > 0 ? products[0].name : "";
    const link = lead.checkout_url || "";

    // Replace variables
    let finalMessage = smsTemplate
      .replace(/\{nome\}/g, firstName)
      .replace(/\{produto\}/g, produtoNome)
      .replace(/\{link\}/g, link);

    // Remove accents
    finalMessage = removeAccents(finalMessage);

    // Check for special chars
    if (hasSpecialChars(finalMessage)) {
      console.error("SMS contains special characters after cleanup, not sending");
      return new Response(
        JSON.stringify({ ok: false, message: "SMS contains invalid characters" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check 160 char limit
    if (finalMessage.length > 160) {
      console.error(`SMS exceeds 160 chars (${finalMessage.length}), not sending`);
      return new Response(
        JSON.stringify({ ok: false, message: `SMS exceeds 160 chars (${finalMessage.length})` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Debit credits (SMS cost)
    const { data: debitOk } = await supabase.rpc("debit_user_credits", {
      _user_id: loja.user_id,
      _quantidade: custo,
      _descricao: `SMS recuperação (${tipo || "carrinho"}) para ${lead.customer_phone} [${custo} moedas]`,
    });

    if (!debitOk) {
      return new Response(
        JSON.stringify({ ok: false, message: "Insufficient credits" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send via IntegraX
    const phone = formatPhone(lead.customer_phone);
    const token = Deno.env.get("INTEGRAX_API_KEY")!;

    console.log("Sending recovery SMS:", { phone, tipo, messageLength: finalMessage.length });

    const smsResponse = await fetch(
      `https://sms.aresfun.com/v1/integration/${token}/send-sms`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: [phone],
          from: "29094",
          message: finalMessage,
        }),
      }
    );

    const smsResult = await smsResponse.text();
    console.log("SMS API response:", smsResponse.status, smsResult);

    if (!smsResponse.ok) {
      // Refund credits on failure
      return new Response(
        JSON.stringify({ error: "SMS API error", details: smsResult }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update lead status
    await supabase.from("recovery_leads")
      .update({ sms_sent_at: new Date().toISOString() })
      .eq("id", lead_id);

    return new Response(
      JSON.stringify({ ok: true, phone, messageLength: finalMessage.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in send-recovery-sms:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
