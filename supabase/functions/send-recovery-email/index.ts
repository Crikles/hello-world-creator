import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseSettings(corpo: string, config: Record<string, unknown>) {
  const m = (tag: string) => (corpo || "").match(new RegExp(`\\{\\{${tag}:([^}]*)\\}\\}`))?.[1];
  const bool = (tag: string, def: boolean) => { const v = m(tag); return v === undefined ? def : v === "true"; };

  return {
    mostrar_saudacao: bool("recovery_mostrar_saudacao", true),
    saudacao: m("recovery_saudacao") || "",
    mostrar_resumo_pedido: bool("recovery_mostrar_resumo", true),
    mostrar_texto_interrupcao: bool("recovery_mostrar_interrupcao", true),
    texto_interrupcao: m("recovery_texto_interrupcao") || "",
    mostrar_beneficios: bool("recovery_mostrar_beneficios", true),
    mostrar_cupom: bool("recovery_mostrar_cupom", !!config.cupom_ativo),
    mostrar_garantia: bool("recovery_mostrar_garantia", true),
    mostrar_cta: bool("recovery_mostrar_cta", true),
    texto_botao: m("recovery_texto_botao") || "Finalizar meu pedido",
    mostrar_ps: bool("recovery_mostrar_ps", true),
    url_cta: m("recovery_url_cta") || "",
    cor_botao: m("recovery_cor_botao") || "#6366f1",
    cor_destaque: m("recovery_cor_destaque") || "#6366f1",
    cor_titulo: m("recovery_cor_titulo") || "#0f172a",
    cor_texto: m("recovery_cor_texto") || "#334155",
    cor_fundo_cupom: m("recovery_cor_fundo_cupom") || "#fff3cd",
    cor_borda_cupom: m("recovery_cor_borda_cupom") || "#ffc107",
    cor_cupom_texto: m("recovery_cor_cupom_texto") || "#d63384",
  };
}

// deno-lint-ignore no-explicit-any
function buildEmailHtml(s: any, vars: Record<string, string>, empresaNome: string, logoUrl: string): string {
  const sections: string[] = [];

  sections.push(`<tr><td style="padding:32px 40px 16px;text-align:center;">
    ${logoUrl ? `<img src="${logoUrl}" alt="${empresaNome}" style="width:56px;height:56px;border-radius:16px;object-fit:cover;margin-bottom:8px;" />` : ""}
    <p style="margin:0;font-size:13px;font-weight:700;color:${s.cor_destaque};">${empresaNome}</p>
  </td></tr>`);

  if (s.mostrar_saudacao) {
    sections.push(`<tr><td style="padding:8px 40px 16px;">
      <h2 style="margin:0 0 12px;font-size:20px;font-weight:800;color:${s.cor_titulo};">Olá, ${vars.nome_cliente} 👋</h2>
      <p style="margin:0;font-size:14px;line-height:1.7;color:${s.cor_texto};">${s.saudacao}</p>
    </td></tr>`);
  }

  if (s.mostrar_resumo_pedido) {
    sections.push(`<tr><td style="padding:8px 40px 16px;">
      <table width="100%" style="background:#f8f9fa;border-radius:12px;border:1px solid #e2e8f0;">
        <tr><td style="padding:16px;">
          <p style="margin:0 0 8px;font-weight:700;font-size:13px;color:${s.cor_titulo};">🛒 Resumo do seu pedido:</p>
          <p style="margin:0;font-size:13px;color:${s.cor_texto};line-height:1.7;">${vars.lista_produtos}</p>
          <p style="margin:12px 0 0;font-size:18px;font-weight:800;color:${s.cor_titulo};">💰 ${vars.valor_total}</p>
        </td></tr>
      </table>
    </td></tr>`);
  }

  if (s.mostrar_texto_interrupcao && s.texto_interrupcao) {
    sections.push(`<tr><td style="padding:8px 40px 16px;">
      <p style="margin:0;font-size:14px;line-height:1.7;color:${s.cor_texto};">${s.texto_interrupcao}</p>
    </td></tr>`);
  }

  if (s.mostrar_beneficios && vars.beneficio_principal) {
    sections.push(`<tr><td style="padding:8px 40px 16px;">
      <p style="margin:0 0 8px;font-size:14px;color:${s.cor_texto};">👉 O que você estava prestes a garantir é uma forma de <strong style="color:${s.cor_destaque};">${vars.beneficio_principal}</strong>.</p>
      <p style="margin:0;font-size:14px;color:${s.cor_texto};line-height:1.8;">
        ${vars.beneficio_1 ? `✔️ ${vars.beneficio_1}<br/>` : ""}
        ${vars.beneficio_2 ? `✔️ ${vars.beneficio_2}<br/>` : ""}
        ${vars.beneficio_3 ? `✔️ ${vars.beneficio_3}` : ""}
      </p>
    </td></tr>`);
  }

  if (s.mostrar_cupom && vars.codigo_cupom) {
    sections.push(`<tr><td style="padding:8px 40px 16px;">
      <table width="100%" style="background:${s.cor_fundo_cupom};border:2px dashed ${s.cor_borda_cupom};border-radius:12px;">
        <tr><td style="padding:20px;text-align:center;">
          <p style="font-weight:700;margin:0 0 4px;font-size:13px;color:${s.cor_titulo};">🎁 Tem um incentivo pra você:</p>
          <p style="font-size:28px;font-weight:800;color:${s.cor_cupom_texto};margin:8px 0;">${vars.codigo_cupom}</p>
          <p style="margin:0;font-size:13px;color:${s.cor_texto};">💸 ${vars.descricao_cupom}</p>
        </td></tr>
      </table>
    </td></tr>`);
  }

  if (s.mostrar_garantia && vars.garantia) {
    sections.push(`<tr><td style="padding:8px 40px 16px;">
      <p style="margin:0;font-size:14px;line-height:1.7;color:${s.cor_texto};">Fique tranquilo: <strong>${vars.garantia}</strong>.</p>
    </td></tr>`);
  }

  // PIX section: QR Code + Copia e Cola
  if (vars.pix_code) {
    sections.push(`<tr><td style="padding:8px 40px 16px;">
      <table width="100%" style="background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0;">
        <tr><td style="padding:20px;text-align:center;">
          <p style="margin:0 0 12px;font-weight:700;font-size:14px;color:#166534;">💳 Pague seu PIX:</p>
          ${vars.pix_qrcode_url ? `<img src="${vars.pix_qrcode_url}" alt="QR Code PIX" style="width:200px;height:200px;margin:0 auto 16px;display:block;border-radius:8px;" />` : ""}
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#166534;">Código Copia e Cola:</p>
          <div style="background:#e2e8f0;border-radius:8px;padding:12px 16px;word-break:break-all;font-family:monospace;font-size:11px;color:#334155;line-height:1.5;text-align:left;">${vars.pix_code}</div>
        </td></tr>
      </table>
    </td></tr>`);
  }

  if (s.mostrar_cta) {
    const ctaUrl = s.url_cta || vars.link_checkout;
    if (ctaUrl && ctaUrl !== "#") {
      const ctaLabel = vars.pix_code ? "Pagar meu PIX" : s.texto_botao;
      sections.push(`<tr><td style="padding:16px 40px 24px;text-align:center;">
        <a href="${ctaUrl}" style="display:inline-block;background:${s.cor_botao};color:#ffffff;padding:14px 36px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;">
          👉 ${ctaLabel}
        </a>
      </td></tr>`);
    }
  }

  if (s.mostrar_ps && vars.ps_reforco_urgencia) {
    sections.push(`<tr><td style="padding:0 40px 24px;">
      <p style="margin:0;font-size:12px;color:#94a3b8;font-style:italic;">P.S.: ${vars.ps_reforco_urgencia}</p>
    </td></tr>`);
  }

  sections.push(`<tr><td style="padding:16px 40px;border-top:1px solid #f1f5f9;">
    <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">Enviado por <strong>${empresaNome}</strong></p>
  </td></tr>`);

  return `<!DOCTYPE html><html><body style="margin:0;padding:20px;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;">
<tr><td><table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
${sections.join("")}
</table></td></tr></table></body></html>`;
}

function replaceSubjectVars(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || "");
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { loja_id, lead_id, customer_email, tipo = "carrinho" } = body;

    if (!loja_id || (!customer_email && !lead_id)) {
      return new Response(JSON.stringify({ error: "Missing loja_id and (customer_email or lead_id)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: config } = await supabase
      .from("recovery_config")
      .select("*")
      .eq("loja_id", loja_id)
      .eq("tipo", tipo)
      .maybeSingle();

    if (!config || !config.ativo) {
      return new Response(JSON.stringify({ ok: false, message: "Recovery not active" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Support both: lookup by lead_id (Corvex/Luna/Adoorei/Vega) or by customer_email (Recovery/Zedy/Shopify)
    let lead: any = null;
    if (lead_id) {
      const { data } = await supabase
        .from("recovery_leads")
        .select("*")
        .eq("id", lead_id)
        .maybeSingle();
      lead = data;
    } else {
      const { data } = await supabase
        .from("recovery_leads")
        .select("*")
        .eq("loja_id", loja_id)
        .eq("customer_email", customer_email)
        .eq("tipo", tipo)
        .eq("status", "pendente")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      lead = data;
    }

    if (!lead) {
      console.error("No lead found", { lead_id, customer_email, loja_id, tipo });
      return new Response(JSON.stringify({ ok: false, message: "No pending lead" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: loja } = await supabase
      .from("lojas")
      .select("user_id, nome")
      .eq("id", loja_id)
      .maybeSingle();

    if (!loja) {
      return new Response(JSON.stringify({ error: "Loja not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: empresa } = await supabase
      .from("empresas")
      .select("nome_fantasia, razao_social, logo_url")
      .eq("loja_id", loja_id)
      .maybeSingle();

    const empresaNome = empresa?.nome_fantasia || empresa?.razao_social || loja.nome || "Loja";
    const logoUrl = empresa?.logo_url || "";

    const products = (lead.products || []) as { name: string; value: number; qty: number }[];
    const listaProdutos = products.map(p => `${p.name} (x${p.qty}) — R$ ${p.value.toFixed(2)}`).join("<br>");
    const valorTotal = `R$ ${Number(lead.total_value || 0).toFixed(2).replace(".", ",")}`;

    const vars: Record<string, string> = {
      nome_cliente: lead.customer_name || "Cliente",
      lista_produtos: listaProdutos || "Seu pedido",
      nome_produto_principal: products.length > 0 ? products[0].name : "seu produto",
      valor_total: valorTotal,
      link_checkout: lead.checkout_url || "#",
      beneficio_principal: config.beneficio_principal || "",
      beneficio_1: config.beneficio_1 || "",
      beneficio_2: config.beneficio_2 || "",
      beneficio_3: config.beneficio_3 || "",
      garantia: config.garantia || "",
      ps_reforco_urgencia: config.ps_reforco_urgencia || "",
      codigo_cupom: config.codigo_cupom || "",
      descricao_cupom: config.descricao_cupom || "",
      pix_code: lead.pix_code || "",
      pix_qrcode_url: lead.pix_qrcode_url || "",
    };

    const s = parseSettings(config.corpo_email || "", config);
    const subject = replaceSubjectVars(config.assunto_email || "Você esqueceu algo 👀", vars);
    const bodyHtml = buildEmailHtml(s, vars, empresaNome, logoUrl);

    // Fetch dynamic cost: custom_prices > system_config > fallback
    const emailConfigKey = `custo_recovery_email_${tipo}`;
    let custEmail = 0.10;

    const { data: sysConf } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", emailConfigKey)
      .maybeSingle();
    if (sysConf) custEmail = sysConf.value;

    const { data: profile } = await supabase
      .from("profiles")
      .select("custom_prices")
      .eq("id", loja.user_id)
      .maybeSingle();
    const customPrices = (profile?.custom_prices || {}) as Record<string, number>;
    if (typeof customPrices[emailConfigKey] === "number") custEmail = customPrices[emailConfigKey];

    const { data: debitOk } = await supabase.rpc("debit_user_credits", {
      _user_id: loja.user_id,
      _quantidade: custEmail,
      _descricao: `Email recuperação (${tipo}) para ${lead.customer_email} [${custEmail} moedas]`,
    });

    if (!debitOk) {
      await supabase.from("recovery_leads").update({ status: "sem_credito" }).eq("id", lead.id);
      return new Response(JSON.stringify({ ok: false, message: "Insufficient credits" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_RECOVERY_API_KEY");

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${empresaNome} <noreply@recuperacaodenegocios.com>`,
        to: [lead.customer_email],
        subject,
        html: bodyHtml,
      }),
    });

    const emailResult = await emailResponse.json();
    console.log("Resend response:", emailResponse.status, JSON.stringify(emailResult));

    if (emailResponse.ok) {
      await supabase.from("recovery_leads")
        .update({ status: "email_enviado", email_sent_at: new Date().toISOString() })
        .eq("id", lead.id);
    } else {
      console.error("Email send failed:", emailResponse.status, JSON.stringify(emailResult));
      // Don't update status on failure — keep as pendente for retry
    }

    return new Response(JSON.stringify({ ok: emailResponse.ok, email: emailResult }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-recovery-email error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
