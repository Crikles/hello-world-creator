import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function removeAccents(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function formatPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)\+\.]/g, "");
  if (cleaned.startsWith("55")) return cleaned;
  return "55" + cleaned;
}

function replaceTemplateVars(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

function buildDefaultEmailHtml(vars: Record<string, string>, empresa: any): string {
  const logoSection = empresa?.logo_url
    ? `<img src="${empresa.logo_url}" alt="${empresa.nome_fantasia || ''}" style="max-height:60px;margin-bottom:16px;" />`
    : "";
  const empresaNome = empresa?.nome_fantasia || empresa?.razao_social || "";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
  <tr><td style="background:#16a34a;padding:32px;text-align:center;">
    ${logoSection}
    <h1 style="color:#ffffff;margin:0;font-size:24px;">Pagamento Confirmado! ✅</h1>
  </td></tr>
  <tr><td style="padding:32px;">
    <p style="font-size:16px;color:#1e293b;margin:0 0 16px;">Olá <strong>${vars.nome}</strong>,</p>
    <p style="font-size:16px;color:#475569;margin:0 0 24px;">Seu pagamento foi confirmado com sucesso! Confira os detalhes:</p>
    <table width="100%" cellpadding="12" cellspacing="0" style="background:#f8fafc;border-radius:8px;margin-bottom:24px;">
      <tr><td style="color:#64748b;font-size:14px;">Produto</td><td style="color:#0f172a;font-size:14px;font-weight:bold;">${vars.produto}</td></tr>
      <tr><td style="color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Valor</td><td style="color:#16a34a;font-size:14px;font-weight:bold;border-top:1px solid #e2e8f0;">R$ ${vars.valor}</td></tr>
    </table>
    <p style="font-size:14px;color:#475569;margin:0;">Obrigado pela sua compra! Seu pedido já está sendo processado.</p>
  </td></tr>
  <tr><td style="background:#f8fafc;padding:24px;text-align:center;border-top:1px solid #e2e8f0;">
    <p style="font-size:12px;color:#94a3b8;margin:0;">${empresaNome}</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pedido_id, loja_id } = await req.json();

    if (!pedido_id || !loja_id) {
      return new Response(
        JSON.stringify({ error: "pedido_id and loja_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Check config
    const { data: config } = await supabase
      .from("confirmacao_pagamento_config")
      .select("*")
      .eq("loja_id", loja_id)
      .maybeSingle();

    if (!config?.ativo) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "not active" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Get pedido data
    const { data: pedido } = await supabase
      .from("pedidos")
      .select("*")
      .eq("id", pedido_id)
      .single();

    if (!pedido) {
      return new Response(
        JSON.stringify({ error: "Pedido not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Get loja owner
    const { data: loja } = await supabase
      .from("lojas")
      .select("user_id")
      .eq("id", loja_id)
      .single();

    if (!loja) {
      return new Response(
        JSON.stringify({ error: "Loja not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Get empresa data
    const { data: empresa } = await supabase
      .from("empresas")
      .select("*")
      .eq("loja_id", loja_id)
      .maybeSingle();

    // 5. Get costs from system_config + custom_prices
    const { data: custos } = await supabase
      .from("system_config")
      .select("key, value")
      .in("key", ["custo_confirmacao_email", "custo_confirmacao_sms"]);

    const custoMap: Record<string, number> = {};
    (custos || []).forEach((c: any) => { custoMap[c.key] = c.value; });

    // Check custom prices
    const { data: profile } = await supabase
      .from("profiles")
      .select("custom_prices")
      .eq("id", loja.user_id)
      .maybeSingle();

    const customPrices = (profile?.custom_prices || {}) as Record<string, number>;
    const custoEmail = customPrices["custo_confirmacao_email"] ?? custoMap["custo_confirmacao_email"] ?? 0.50;
    const custoSms = customPrices["custo_confirmacao_sms"] ?? custoMap["custo_confirmacao_sms"] ?? 0.12;

    // Parse product name
    let produtoNome = pedido.customer_name || "Produto";
    try {
      if (pedido.products) {
        const prods = typeof pedido.products === "string" ? JSON.parse(pedido.products) : pedido.products;
        if (Array.isArray(prods) && prods.length > 0) {
          produtoNome = prods.map((p: any) => p.title || p.nome || "Produto").join(", ");
        }
      }
    } catch { /* ignore */ }

    const templateVars: Record<string, string> = {
      nome: (pedido.customer_name || "Cliente").split(" ")[0],
      nome_completo: pedido.customer_name || "Cliente",
      email: pedido.customer_email || "",
      produto: produtoNome,
      valor: (pedido.total_price / 100).toFixed(2).replace(".", ","),
      empresa: empresa?.nome_fantasia || empresa?.razao_social || "",
    };

    const results: { email?: string; sms?: string } = {};

    // 6. Send email
    if (config.enviar_email && pedido.customer_email) {
      const resendKey = Deno.env.get("RESEND_CONFIRMATION_API_KEY") || Deno.env.get("RESEND_API_KEY");
      if (!resendKey) {
        console.error("[payment-confirmation] No Resend API key configured");
      } else {
        // Debit credits
        const { data: debited } = await supabase.rpc("debit_user_credits", {
          _user_id: loja.user_id,
          _quantidade: custoEmail,
          _descricao: `Email confirmação pagamento - ${pedido.customer_email}`,
        });

        if (!debited) {
          console.error("[payment-confirmation] Insufficient credits for email");
          await supabase.from("confirmacao_pagamento_log").insert({
            loja_id, pedido_id, tipo: "email", status: "failed",
            custo: 0, destinatario: pedido.customer_email,
            error_reason: "Saldo insuficiente",
          });
        } else {
          const subject = replaceTemplateVars(config.assunto_email, templateVars);
          const htmlBody = config.corpo_email
            ? replaceTemplateVars(config.corpo_email, templateVars)
            : buildDefaultEmailHtml(templateVars, empresa);

          const fromEmail = empresa?.email
            ? `${empresa.nome_fantasia || "Loja"} <${empresa.email}>`
            : "Confirmação <noreply@jltransportes.pro>";

          try {
            const emailRes = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${resendKey}`,
              },
              body: JSON.stringify({
                from: fromEmail,
                to: [pedido.customer_email],
                subject,
                html: htmlBody,
              }),
            });

            const emailResult = await emailRes.json();

            if (emailRes.ok) {
              await supabase.from("confirmacao_pagamento_log").insert({
                loja_id, pedido_id, tipo: "email", status: "sent",
                custo: custoEmail, destinatario: pedido.customer_email,
              });
              results.email = "sent";
            } else {
              console.error("[payment-confirmation] Email error:", emailResult);
              await supabase.from("confirmacao_pagamento_log").insert({
                loja_id, pedido_id, tipo: "email", status: "failed",
                custo: custoEmail, destinatario: pedido.customer_email,
                error_reason: JSON.stringify(emailResult),
              });
              results.email = "failed";
            }
          } catch (err) {
            console.error("[payment-confirmation] Email exception:", err);
            await supabase.from("confirmacao_pagamento_log").insert({
              loja_id, pedido_id, tipo: "email", status: "failed",
              custo: custoEmail, destinatario: pedido.customer_email,
              error_reason: String(err),
            });
            results.email = "failed";
          }
        }
      }
    }

    // 7. Send SMS
    if (config.enviar_sms && pedido.customer_phone) {
      const integraxKey = Deno.env.get("INTEGRAX_API_KEY");
      if (!integraxKey) {
        console.error("[payment-confirmation] No INTEGRAX_API_KEY configured");
      } else {
        const { data: debited } = await supabase.rpc("debit_user_credits", {
          _user_id: loja.user_id,
          _quantidade: custoSms,
          _descricao: `SMS confirmação pagamento - ${pedido.customer_phone}`,
        });

        if (!debited) {
          console.error("[payment-confirmation] Insufficient credits for SMS");
          await supabase.from("confirmacao_pagamento_log").insert({
            loja_id, pedido_id, tipo: "sms", status: "failed",
            custo: 0, destinatario: pedido.customer_phone,
            error_reason: "Saldo insuficiente",
          });
        } else {
          const smsMessage = removeAccents(replaceTemplateVars(config.sms_template, templateVars));
          const phone = formatPhone(pedido.customer_phone);

          try {
            const smsRes = await fetch(
              `https://sms.aresfun.com/v1/integration/${integraxKey}/send-sms`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  to: [phone],
                  from: "29094",
                  message: smsMessage,
                }),
              }
            );

            if (smsRes.ok) {
              await supabase.from("confirmacao_pagamento_log").insert({
                loja_id, pedido_id, tipo: "sms", status: "sent",
                custo: custoSms, destinatario: phone,
              });
              results.sms = "sent";
            } else {
              const smsErr = await smsRes.text();
              console.error("[payment-confirmation] SMS error:", smsErr);
              await supabase.from("confirmacao_pagamento_log").insert({
                loja_id, pedido_id, tipo: "sms", status: "failed",
                custo: custoSms, destinatario: phone,
                error_reason: smsErr,
              });
              results.sms = "failed";
            }
          } catch (err) {
            console.error("[payment-confirmation] SMS exception:", err);
            await supabase.from("confirmacao_pagamento_log").insert({
              loja_id, pedido_id, tipo: "sms", status: "failed",
              custo: custoSms, destinatario: phone,
              error_reason: String(err),
            });
            results.sms = "failed";
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[payment-confirmation] Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
