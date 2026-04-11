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

/* ─── Parse metadata tags from corpo_email ─── */
function parseConfTag(corpo: string, tag: string): string | undefined {
  return corpo.match(new RegExp(`\\{\\{${tag}:([^}]*)\\}\\}`))?.[1];
}

function parseConfBool(corpo: string, tag: string, def: boolean): boolean {
  const v = parseConfTag(corpo, tag);
  return v === undefined ? def : v === "true";
}

/* ─── Build email HTML from metadata tags ─── */
function buildEmailFromTags(corpo: string, vars: Record<string, string>, empresa: any): string {
  const saudacao = parseConfTag(corpo, "conf_saudacao") || `Olá ${vars.nome}, seu pagamento foi confirmado com sucesso! ✅`;
  const mostrarResumo = parseConfBool(corpo, "conf_mostrar_resumo", true);
  const mensagem = parseConfTag(corpo, "conf_mensagem") || "Seu pedido já está sendo processado.";
  const mostrarCta = parseConfBool(corpo, "conf_mostrar_cta", false);
  const textoBotao = parseConfTag(corpo, "conf_texto_botao") || "Acompanhar Pedido";
  const urlCta = parseConfTag(corpo, "conf_url_cta") || "";
  const rodape = parseConfTag(corpo, "conf_rodape") || "Obrigado pela sua compra!";
  const corHeader = parseConfTag(corpo, "conf_cor_header") || "#16a34a";
  const corBotao = parseConfTag(corpo, "conf_cor_botao") || "#16a34a";
  const corDestaque = parseConfTag(corpo, "conf_cor_destaque") || "#16a34a";
  const corTexto = parseConfTag(corpo, "conf_cor_texto") || "#334155";

  const empresaNome = empresa?.nome_fantasia || empresa?.razao_social || "";
  const logoSection = empresa?.logo_url
    ? `<img src="${empresa.logo_url}" alt="${empresaNome}" style="max-height:60px;margin-bottom:16px;border-radius:8px;" />`
    : "";

  const sections: string[] = [];

  // Header
  sections.push(`<tr><td style="background:${corHeader};padding:32px;text-align:center;">
    ${logoSection}
    <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:800;">Pagamento Confirmado! ✅</h1>
  </td></tr>`);

  // Saudação
  sections.push(`<tr><td style="padding:32px 32px 16px;">
    <p style="font-size:16px;color:#1e293b;margin:0 0 16px;line-height:1.6;">${replaceTemplateVars(saudacao, vars)}</p>
  </td></tr>`);

  // Resumo
  if (mostrarResumo) {
    sections.push(`<tr><td style="padding:0 32px 16px;">
      <table width="100%" cellpadding="12" cellspacing="0" style="background:#f8fafc;border-radius:8px;margin-bottom:8px;">
        <tr><td style="color:#64748b;font-size:14px;">Produto</td><td style="color:#0f172a;font-size:14px;font-weight:bold;">${vars.produto}</td></tr>
        <tr><td style="color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Valor</td><td style="color:${corDestaque};font-size:14px;font-weight:bold;border-top:1px solid #e2e8f0;">R$ ${vars.valor}</td></tr>
      </table>
    </td></tr>`);
  }

  // Mensagem
  if (mensagem) {
    sections.push(`<tr><td style="padding:0 32px 16px;">
      <p style="font-size:14px;color:${corTexto};margin:0;line-height:1.7;">${replaceTemplateVars(mensagem, vars)}</p>
    </td></tr>`);
  }

  // CTA
  if (mostrarCta && textoBotao && urlCta) {
    sections.push(`<tr><td style="padding:8px 32px 24px;text-align:center;">
      <a href="${urlCta}" style="display:inline-block;background:${corBotao};color:#ffffff;padding:14px 36px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;">
        ${textoBotao}
      </a>
    </td></tr>`);
  }

  // Rodapé
  sections.push(`<tr><td style="background:#f8fafc;padding:24px;text-align:center;border-top:1px solid #e2e8f0;">
    <p style="font-size:13px;color:#94a3b8;margin:0;">${replaceTemplateVars(rodape, vars)}</p>
    <p style="font-size:11px;color:#cbd5e1;margin:8px 0 0;">${empresaNome}</p>
  </td></tr>`);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
${sections.join("")}
</table>
</td></tr></table></body></html>`;
}

/* ─── Fallback for configs without metadata tags (legacy) ─── */
function buildDefaultEmailHtml(vars: Record<string, string>, empresa: any): string {
  return buildEmailFromTags("", vars, empresa);
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

    // 5. Get costs
    const { data: custos } = await supabase
      .from("system_config")
      .select("key, value")
      .in("key", ["custo_confirmacao_email", "custo_confirmacao_sms"]);

    const custoMap: Record<string, number> = {};
    (custos || []).forEach((c: any) => { custoMap[c.key] = c.value; });

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

          // Build HTML: use metadata tags if present, otherwise default
          const htmlBody = (config.corpo_email && config.corpo_email.includes("{{conf_"))
            ? buildEmailFromTags(config.corpo_email, templateVars, empresa)
            : buildDefaultEmailHtml(templateVars, empresa);

          const remetenteNome = config.email_remetente_nome || empresa?.nome_fantasia || empresa?.razao_social || "Loja";
          const fromEmail = `${remetenteNome} <contato@recuperacaodenegocios.com>`;

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
