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
  // New format: [conf_tag:value]
  const n = corpo.match(new RegExp(`\\[${tag}:([^\\]]*)\\]`));
  if (n) return n[1];
  // Legacy format: {{conf_tag:value}}
  return corpo.match(new RegExp(`\\{\\{${tag}:([^}]*)\\}\\}`))?.[1];
}

function parseConfBool(corpo: string, tag: string, def: boolean): boolean {
  const v = parseConfTag(corpo, tag);
  return v === undefined ? def : v === "true";
}

/* ─── Build email HTML from metadata tags ─── */
function buildEmailFromTags(corpo: string, vars: Record<string, string>, empresa: any): string {
  // Parse conf tags from raw corpo first (new [] format doesn't conflict with {{nome}})
  const rawSaudacao = parseConfTag(corpo, "conf_saudacao") || `Olá {{nome}}, seu pagamento foi confirmado com sucesso!`;
  const mostrarSaudacao = parseConfBool(corpo, "conf_mostrar_saudacao", true);
  const mostrarResumo = parseConfBool(corpo, "conf_mostrar_resumo", true);
  const rawMensagem = parseConfTag(corpo, "conf_mensagem") || "Seu pedido já está sendo processado.";
  const mostrarMensagem = parseConfBool(corpo, "conf_mostrar_mensagem", true);
  const mostrarCta = parseConfBool(corpo, "conf_mostrar_cta", false);
  const textoBotao = parseConfTag(corpo, "conf_texto_botao") || "Acompanhar Pedido";
  const urlCta = parseConfTag(corpo, "conf_url_cta") || "";
  const rawRodape = parseConfTag(corpo, "conf_rodape") || "Obrigado pela sua compra!";
  const mostrarRodape = parseConfBool(corpo, "conf_mostrar_rodape", true);

  // Now replace template variables like {{nome}}, {{produto}}, etc.
  const saudacao = replaceTemplateVars(rawSaudacao, vars);
  const mensagem = replaceTemplateVars(rawMensagem, vars);
  const rodape = replaceTemplateVars(rawRodape, vars);
  const corPrimaria = parseConfTag(corpo, "conf_cor_primaria") || parseConfTag(corpo, "conf_cor_header") || "#16a34a";
  const corTexto = parseConfTag(corpo, "conf_cor_texto") || "#333333";

  const empresaNome = empresa?.nome_fantasia || empresa?.razao_social || "";
  const logoSection = empresa?.logo_url
    ? `<td style="width:40px;"><img src="${empresa.logo_url}" alt="${empresaNome}" style="max-height:36px;border-radius:6px;" /></td>`
    : "";

  const sections: string[] = [];

  // Simple header
  sections.push(`<tr><td style="padding:24px 32px 16px;border-bottom:2px solid ${corPrimaria};">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      ${logoSection}
      <td style="padding-left:${empresa?.logo_url ? '12' : '0'}px;">
        <p style="margin:0;font-size:15px;font-weight:700;color:${corPrimaria};">Pagamento Confirmado</p>
        <p style="margin:2px 0 0;font-size:12px;color:#888;">${empresaNome}</p>
      </td>
    </tr></table>
  </td></tr>`);

  // Saudação
  if (mostrarSaudacao) {
    sections.push(`<tr><td style="padding:24px 32px 8px;">
      <p style="font-size:15px;color:#222;margin:0;line-height:1.5;">${saudacao}</p>
    </td></tr>`);
  }

  // Resumo
  if (mostrarResumo) {
    sections.push(`<tr><td style="padding:12px 32px;">
      <table width="100%" cellpadding="8" cellspacing="0" style="background:#f9f9f9;border-radius:6px;border:1px solid #eee;">
        <tr><td style="color:#666;font-size:13px;">Produto</td><td style="color:#222;font-size:13px;font-weight:600;text-align:right;">${vars.produto}</td></tr>
        <tr><td style="color:#666;font-size:13px;border-top:1px solid #eee;">Valor</td><td style="color:${corPrimaria};font-size:13px;font-weight:600;text-align:right;border-top:1px solid #eee;">R$ ${vars.valor}</td></tr>
      </table>
    </td></tr>`);
  }

  // Mensagem
  if (mostrarMensagem && mensagem) {
    sections.push(`<tr><td style="padding:8px 32px;">
      <p style="font-size:14px;color:${corTexto};margin:0;line-height:1.6;">${mensagem}</p>
    </td></tr>`);
  }

  // CTA
  if (mostrarCta && textoBotao && urlCta) {
    sections.push(`<tr><td style="padding:16px 32px;text-align:center;">
      <a href="${urlCta}" style="display:inline-block;background:${corPrimaria};color:#ffffff;padding:10px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">
        ${textoBotao}
      </a>
    </td></tr>`);
  }

  // Rodapé
  if (mostrarRodape) {
    sections.push(`<tr><td style="padding:20px 32px 24px;border-top:1px solid #eee;">
      <p style="font-size:12px;color:#999;margin:0;text-align:center;">${rodape}</p>
    </td></tr>`);
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
${sections.join("")}
</table>
</td></tr></table></body></html>`;
}

/* ─── Fallback for configs without metadata tags (legacy) ─── */
function buildDefaultEmailHtml(vars: Record<string, string>, empresa: any): string {
  return buildEmailFromTags("", vars, empresa);
}

type GlobalLang = "en" | "es";

const GLOBAL_CONFIRM_I18N = {
  en: {
    header: "Payment Confirmed",
    preview: "Your international payment has been confirmed",
    greeting: (n: string) => `Hi ${n},`,
    intro: "Your payment has been confirmed and your international order is now being processed.",
    product: "Product",
    value: "Amount",
    cta: "Track your order",
    footer: "Thank you for shopping with us.",
  },
  es: {
    header: "Pago Confirmado",
    preview: "Tu pago internacional ha sido confirmado",
    greeting: (n: string) => `Hola ${n},`,
    intro: "Tu pago ha sido confirmado y tu pedido internacional está siendo procesado.",
    product: "Producto",
    value: "Valor",
    cta: "Rastrear pedido",
    footer: "Gracias por tu compra.",
  },
} as const;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function buildGlobalConfirmationEmail(
  lang: GlobalLang,
  vars: Record<string, string>,
  empresa: any,
  originCountry: string,
  trackingLink: string
): string {
  const t = GLOBAL_CONFIRM_I18N[lang];
  const empresaNome = empresa?.nome_fantasia || empresa?.razao_social || "";
  const accent = "#1e40af";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(t.preview)}</div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
  <tr><td style="padding:24px 32px 16px;border-bottom:2px solid ${accent};">
    <p style="margin:0;font-size:15px;font-weight:700;color:${accent};">${escapeHtml(t.header)}</p>
    <p style="margin:2px 0 0;font-size:12px;color:#888;">${escapeHtml(empresaNome)} · ${lang === "es" ? "Enviado desde" : "Shipped from"} ${escapeHtml(originCountry)}</p>
  </td></tr>
  <tr><td style="padding:24px 32px 8px;">
    <p style="font-size:15px;color:#222;margin:0 0 8px;">${escapeHtml(t.greeting(vars.nome))}</p>
    <p style="font-size:14px;color:#555;margin:0;">${escapeHtml(t.intro)}</p>
  </td></tr>
  <tr><td style="padding:8px 32px;">
    <table width="100%" cellpadding="8" cellspacing="0" style="background:#f9f9f9;border-radius:6px;border:1px solid #eee;">
      <tr><td style="color:#666;font-size:13px;">${escapeHtml(t.product)}</td><td style="color:#222;font-size:13px;font-weight:600;text-align:right;">${escapeHtml(vars.produto)}</td></tr>
      <tr><td style="color:#666;font-size:13px;border-top:1px solid #eee;">${escapeHtml(t.value)}</td><td style="color:${accent};font-size:13px;font-weight:600;text-align:right;border-top:1px solid #eee;">R$ ${escapeHtml(vars.valor)}</td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:20px 32px;text-align:center;">
    <a href="${escapeHtml(trackingLink)}" style="display:inline-block;background:${accent};color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">
      ${escapeHtml(t.cta)}
    </a>
  </td></tr>
  <tr><td style="padding:20px 32px 24px;border-top:1px solid #eee;text-align:center;">
    <p style="font-size:12px;color:#999;margin:0;">${escapeHtml(t.footer)}</p>
  </td></tr>
</table>
</td></tr></table></body></html>`;
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pedido_id, loja_id, retry } = await req.json();

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

    // 1. Get pedido data
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

    // 2. Get loja owner
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

    // 3. Get empresa data
    const { data: empresa } = await supabase
      .from("empresas")
      .select("*")
      .eq("loja_id", loja_id)
      .maybeSingle();

    // 4. Check if this is an international order managed by the Global flow
    let globalConfig: any = null;
    let envioGlobal: any = null;
    if (pedido.envio_id) {
      const { data: envio } = await supabase
        .from("envios")
        .select("id, is_international, global_flow_lang, codigo_rastreio")
        .eq("id", pedido.envio_id)
        .maybeSingle();
      if (envio?.is_international) {
        envioGlobal = envio;
        const { data: gcfg } = await supabase
          .from("global_flow_config")
          .select("ativo, idioma, confirmacao_email, pais_origem_nome")
          .eq("loja_id", loja_id)
          .maybeSingle();
        globalConfig = gcfg;
      }
    }

    if (envioGlobal && globalConfig) {
      if (!globalConfig.ativo || !globalConfig.confirmacao_email) {
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: "global flow not active or confirmation email disabled" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Use global confirmation email (no SMS confirmation for Global)
      const { data: custos } = await supabase
        .from("system_config")
        .select("key, value")
        .in("key", ["custo_global_flow_confirmacao_email"]);
      const custoMap: Record<string, number> = {};
      (custos || []).forEach((c: any) => { custoMap[c.key] = c.value; });
      const { data: profile } = await supabase
        .from("profiles")
        .select("custom_prices")
        .eq("id", loja.user_id)
        .maybeSingle();
      const customPrices = (profile?.custom_prices || {}) as Record<string, number>;
      const custoEmail = customPrices["custo_global_flow_confirmacao_email"] ?? custoMap["custo_global_flow_confirmacao_email"] ?? 1.00;

      // Parse product name
      let produtoNome = "Product";
      try {
        if (pedido.products) {
          const prods = typeof pedido.products === "string" ? JSON.parse(pedido.products) : pedido.products;
          if (Array.isArray(prods) && prods.length > 0) {
            produtoNome = prods.map((p: any) => p.title || p.nome || p.name || "Product").join(", ");
          }
        }
      } catch { /* ignore */ }

      const firstName = (pedido.customer_name || "Customer").split(" ")[0];
      const lang: GlobalLang = (envioGlobal.global_flow_lang || globalConfig.idioma || "en") as GlobalLang;
      const templateVars: Record<string, string> = {
        nome: firstName,
        produto: produtoNome,
        valor: (pedido.total_price / 100).toFixed(2).replace(".", ","),
      };
      const trackingLink = `https://atlas-cargo.org/r/${envioGlobal.codigo_rastreio || ""}`;
      const originCountry = globalConfig.pais_origem_nome || "";

      const results: { email?: string } = {};

      if (retry) {
        const { data: recentLogs } = await supabase
          .from("confirmacao_pagamento_log")
          .select("tipo, status, created_at")
          .eq("pedido_id", pedido_id)
          .order("created_at", { ascending: false })
          .limit(5);
        const lastEmail = recentLogs?.find((l) => l.tipo === "email");
        if (lastEmail?.status === "sent") {
          return new Response(
            JSON.stringify({ success: true, skipped: true, reason: "already sent" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      if (pedido.customer_email) {
        const resendKey = Deno.env.get("RESEND_CONFIRMATION_API_KEY") || Deno.env.get("RESEND_API_KEY");
        if (!resendKey) {
          console.error("[payment-confirmation/global] No Resend API key configured");
          results.email = "skipped_no_key";
        } else {
          const { data: debited } = await supabase.rpc("debit_user_credits", {
            _user_id: loja.user_id,
            _quantidade: custoEmail,
            _descricao: `Email confirmação pagamento global - ${pedido.customer_email}`,
          });
          if (!debited) {
            console.warn("[payment-confirmation/global] Insufficient credits for email");
            results.email = "skipped_no_credits";
          } else {
            const html = buildGlobalConfirmationEmail(lang, templateVars, empresa, originCountry, trackingLink);
            const remetenteNome = empresa?.nome_fantasia || empresa?.razao_social || "Store";
            const fromEmail = `${remetenteNome} <contato@recuperacaodenegocios.com>`;
            try {
              const emailRes = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
                body: JSON.stringify({
                  from: fromEmail,
                  to: [pedido.customer_email],
                  subject: GLOBAL_CONFIRM_I18N[lang].header,
                  html,
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
                console.error("[payment-confirmation/global] Email error:", emailResult);
                await supabase.from("confirmacao_pagamento_log").insert({
                  loja_id, pedido_id, tipo: "email", status: "failed",
                  custo: custoEmail, destinatario: pedido.customer_email,
                  error_reason: JSON.stringify(emailResult),
                });
                results.email = "failed";
              }
            } catch (err) {
              console.error("[payment-confirmation/global] Email exception:", err);
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

      return new Response(
        JSON.stringify({ success: true, global: true, results }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Standard confirmation flow (non-international orders)
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

    // 6. Get costs
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
    let produtoNome = "Produto";
    try {
      if (pedido.products) {
        const prods = typeof pedido.products === "string" ? JSON.parse(pedido.products) : pedido.products;
        if (Array.isArray(prods) && prods.length > 0) {
          produtoNome = prods.map((p: any) => p.title || p.nome || p.name || "Produto").join(", ");
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

    // On retry, skip channels whose latest log is already "sent" to avoid double-charge
    let alreadySentEmail = false;
    let alreadySentSms = false;
    if (retry) {
      const { data: recentLogs } = await supabase
        .from("confirmacao_pagamento_log")
        .select("tipo, status, created_at")
        .eq("pedido_id", pedido_id)
        .order("created_at", { ascending: false })
        .limit(20);
      const seen = new Set<string>();
      for (const l of recentLogs || []) {
        if (seen.has(l.tipo)) continue;
        seen.add(l.tipo);
        if (l.status === "sent") {
          if (l.tipo === "email") alreadySentEmail = true;
          if (l.tipo === "sms") alreadySentSms = true;
        }
      }
    }

    // 6. Send email
    if (config.enviar_email && pedido.customer_email && !alreadySentEmail) {
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
          console.warn("[payment-confirmation] Insufficient credits for email — skipping log entry");
          // Skip creating noisy "failed" log: it's an expected condition, not a bug
        } else {
          const subject = replaceTemplateVars(config.assunto_email, templateVars);

          // Build HTML: use metadata tags if present, otherwise default
          const htmlBody = (config.corpo_email && (config.corpo_email.includes("[conf_") || config.corpo_email.includes("{{conf_")))
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
    if (config.enviar_sms && pedido.customer_phone && !alreadySentSms) {
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
          console.warn("[payment-confirmation] Insufficient credits for SMS — skipping log entry");
          // Skip creating noisy "failed" log: it's an expected condition, not a bug
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
