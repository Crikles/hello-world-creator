import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  EMAIL_TEMPLATES,
  SMS_TEMPLATES,
  STEP_LABELS,
  type EmailContent,
  type Lang,
} from "./templates.ts";
import { getTrackingUrl, resolveMarca } from "../_shared/tracking-url.ts";

function interpolate(tpl: string, vars: Record<string, string>): string {
  return (tpl || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function removeAccents(t: string): string {
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function formatPhone(phone: string): string {
  const c = phone.replace(/[\s\-\(\)\+\.]/g, "");
  return c.startsWith("55") ? c : "55" + c;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function buildEmailHtml(
  lang: Lang,
  currentStep: number,
  content: EmailContent,
  link: string,
  empresaNome: string,
  originCountry: string,
): string {
  const labels = STEP_LABELS[lang];
  const accent = "#1e40af";
  const done = "#16a34a";
  const muted = "#9ca3af";

  const stepsHtml = labels
    .map((label, i) => {
      const n = i + 1;
      const isDone = n < currentStep;
      const isCurrent = n === currentStep;
      const color = isCurrent ? accent : isDone ? done : muted;
      const weight = isCurrent ? 700 : isDone ? 500 : 400;
      const icon = isDone ? "✓" : isCurrent ? "●" : "○";
      return `<tr><td style="padding:8px 0;color:${color};font-size:14px;font-weight:${weight};">
        <span style="display:inline-block;width:22px;text-align:center;">${icon}</span>
        ${n}. ${escapeHtml(label)}
      </td></tr>`;
    })
    .join("");

  const hintHtml = content.hint
    ? `<tr><td style="padding:0 32px 8px;">
        <div style="background:#eff6ff;border-left:3px solid ${accent};padding:10px 14px;border-radius:4px;font-size:13px;color:#1e3a8a;">
          ${escapeHtml(content.hint)}
        </div>
      </td></tr>`
    : "";

  const productLabel = lang === "es" ? "Producto" : "Product";
  const productHtml = content.product
    ? `<tr><td style="padding:0 32px 8px;">
        <table width="100%" cellpadding="10" cellspacing="0" style="background:#f9f9f9;border-radius:6px;border:1px solid #eee;">
          <tr>
            <td style="color:#666;font-size:13px;">${productLabel}</td>
            <td style="color:#222;font-size:13px;font-weight:600;text-align:right;">${escapeHtml(content.product)}</td>
          </tr>
        </table>
      </td></tr>`
    : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(content.preview)}</div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
  <tr><td style="padding:24px 32px 16px;border-bottom:2px solid ${accent};">
    <p style="margin:0;font-size:18px;font-weight:700;color:${accent};">${escapeHtml(content.headline)}</p>
    <p style="margin:4px 0 0;font-size:12px;color:#888;">${escapeHtml(empresaNome)} · ${lang === "es" ? "Enviado desde" : "Shipped from"} ${escapeHtml(originCountry)}</p>
  </td></tr>
  <tr><td style="padding:24px 32px 8px;">
    <p style="font-size:15px;color:#222;margin:0 0 12px;">${escapeHtml(content.intro)}</p>

    <p style="font-size:14px;color:#444;line-height:1.55;margin:0;">${escapeHtml(content.body)}</p>
  </td></tr>
  ${productHtml}
  ${hintHtml}

  <tr><td style="padding:16px 32px 8px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:6px;border:1px solid #eee;padding:12px 16px;">
      ${stepsHtml}
    </table>
  </td></tr>
  <tr><td style="padding:20px 32px;text-align:center;">
    <a href="${escapeHtml(link)}" style="display:inline-block;background:${accent};color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">
      ${escapeHtml(content.ctaLabel)}
    </a>
  </td></tr>
  <tr><td style="padding:20px 32px 24px;border-top:1px solid #eee;text-align:center;">
    <p style="font-size:13px;color:#555;margin:0 0 4px;">${escapeHtml(content.closing)}</p>
    <p style="font-size:13px;color:#222;font-weight:600;margin:0;">${escapeHtml(empresaNome)}</p>
  </td></tr>
</table>
</td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { envio_id, step } = await req.json();
    if (!envio_id || !step || step < 1 || step > 10) {
      return new Response(JSON.stringify({ error: "envio_id and step (1-10) are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: envio } = await supabase
      .from("envios")
      .select("id, loja_id, cliente_nome, cliente_email, cliente_telefone, codigo_rastreio, is_international, global_flow_lang, marca, produto")
      .eq("id", envio_id)
      .single();


    if (!envio) {
      return new Response(JSON.stringify({ error: "Envio not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!envio.is_international) {
      return new Response(JSON.stringify({ success: true, skipped: "not international" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: config } = await supabase
      .from("global_flow_config")
      .select("*")
      .eq("loja_id", envio.loja_id)
      .maybeSingle();

    if (!config?.ativo) {
      return new Response(JSON.stringify({ success: true, skipped: "global flow not active" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lang: Lang = (envio.global_flow_lang || config.idioma || "en") as Lang;
    const firstName = (envio.cliente_nome || (lang === "es" ? "Cliente" : "Customer")).split(" ")[0];
    const marca = resolveMarca({
      marca: (envio as any).marca,
      is_international: envio.is_international,
      global_flow_lang: lang,
      codigo_rastreio: envio.codigo_rastreio,
    });
    const link = getTrackingUrl(marca, envio.codigo_rastreio || "");

    const { data: loja } = await supabase.from("lojas").select("user_id").eq("id", envio.loja_id).single();
    const { data: empresa } = await supabase
      .from("empresas")
      .select("nome_fantasia, razao_social")
      .eq("loja_id", envio.loja_id)
      .maybeSingle();
    const empresaNome = empresa?.nome_fantasia || empresa?.razao_social || "";

    // Parse product name from envio.produto (JSON array or plain text)
    let produtoNome = "";
    try {
      const raw = (envio as any).produto;
      if (raw) {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed)) {
          produtoNome = parsed.map((p: any) => p.title || p.nome || p.name || "").filter(Boolean).join(", ");
        } else {
          produtoNome = String(raw);
        }
      }
    } catch {
      produtoNome = String((envio as any).produto || "");
    }

    const ctx = {
      name: firstName,
      empresa: empresaNome || (lang === "es" ? "nuestra tienda" : "our store"),
      originCountry: config.pais_origem_nome || "",
      tracking: envio.codigo_rastreio || "",
      produto: produtoNome,
    };


    const { data: custos } = await supabase
      .from("system_config")
      .select("key, value")
      .in("key", ["custo_global_flow_email", "custo_global_flow_sms"]);
    const custoMap: Record<string, number> = {};
    (custos || []).forEach((c: any) => { custoMap[c.key] = c.value; });
    let customPrices: Record<string, number> = {};
    if (loja?.user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("custom_prices")
        .eq("id", loja.user_id)
        .maybeSingle();
      customPrices = (profile?.custom_prices || {}) as Record<string, number>;
    }
    const resolveCusto = (key: string, fallback: number) =>
      customPrices[key] !== undefined ? Number(customPrices[key]) : (custoMap[key] ?? fallback);
    const custoEmailFluxo = resolveCusto("custo_global_flow_email", 1.20);
    const custoEmail = custoEmailFluxo / 10;
    const custoSms = resolveCusto("custo_global_flow_sms", 0.20);

    const results: { email?: string; sms?: string } = {};

    // Load admin-editable templates (system table, EN/ES)
    const { data: tplRows } = await supabase
      .from("global_flow_system_templates")
      .select("*")
      .eq("step_order", step)
      .eq("lang", lang)
      .maybeSingle();

    const interpVars: Record<string, string> = {
      name: ctx.name,
      empresa: ctx.empresa,
      originCountry: ctx.originCountry,
      tracking: ctx.tracking,
    };

    // EMAIL
    const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,24}$/;
    const emailValid = !!envio.cliente_email && emailRegex.test(String(envio.cliente_email).trim());
    if (config.enviar_email && emailValid && loja?.user_id) {
      const resendKey = Deno.env.get("RESEND_TRACKING_API_KEY") || Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        const { data: debited } = await supabase.rpc("debit_user_credits", {
          _user_id: loja.user_id,
          _quantidade: custoEmail,
          _descricao: `Global flow email step ${step} - ${envio.cliente_email}`,
        });
        if (debited) {
          let content: EmailContent;
          if (tplRows) {
            content = {
              subject: interpolate(tplRows.subject, interpVars),
              preview: interpolate(tplRows.preview, interpVars),
              headline: interpolate(tplRows.headline, interpVars),
              intro: interpolate(tplRows.intro, interpVars),
              body: interpolate(tplRows.body, interpVars),
              hint: tplRows.hint ? interpolate(tplRows.hint, interpVars) : undefined,
              ctaLabel: interpolate(tplRows.cta_label, interpVars),
              closing: interpolate(tplRows.closing, interpVars),
              product: step === 1 && ctx.produto ? ctx.produto : undefined,
            };
          } else {
            content = EMAIL_TEMPLATES[lang][step](ctx);
          }

          const html = buildEmailHtml(lang, step, content, link, ctx.empresa, ctx.originCountry);
          const fromName = empresaNome || "Tracking";
          const from = `${fromName} <noreply@holdingtransportesbr.com>`;
          try {
            const r = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
              body: JSON.stringify({
                from,
                to: [envio.cliente_email],
                subject: content.subject,
                html,
              }),
            });
            results.email = r.ok ? "sent" : "failed";
            if (!r.ok) console.error("[send-global-flow] email error:", await r.text());
          } catch (err) {
            console.error("[send-global-flow] email exception:", err);
            results.email = "failed";
          }
        } else {
          results.email = "skipped_no_credits";
        }
      } else {
        results.email = "skipped_no_key";
      }
    }

    // SMS
    if (config.enviar_sms && envio.cliente_telefone && loja?.user_id) {
      const integraxKey = Deno.env.get("INTEGRAX_API_KEY");
      if (integraxKey) {
        const { data: debited } = await supabase.rpc("debit_user_credits", {
          _user_id: loja.user_id,
          _quantidade: custoSms,
          _descricao: `Global flow SMS step ${step} - ${envio.cliente_telefone}`,
        });
        if (debited) {
          const phone = formatPhone(envio.cliente_telefone);
          const rawMsg = tplRows?.sms_texto
            ? interpolate(tplRows.sms_texto, { ...interpVars, link })
            : SMS_TEMPLATES[lang][step]({ ...ctx, link });
          const message = removeAccents(rawMsg);
          try {
            const r = await fetch(
              `https://sms.aresfun.com/v1/integration/${integraxKey}/send-sms`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ to: [phone], from: "29094", message }),
              }
            );
            results.sms = r.ok ? "sent" : "failed";
            if (!r.ok) console.error("[send-global-flow] sms error:", await r.text());
          } catch (err) {
            console.error("[send-global-flow] sms exception:", err);
            results.sms = "failed";
          }
        } else {
          results.sms = "skipped_no_credits";
        }
      } else {
        results.sms = "skipped_no_key";
      }
    }


    return new Response(JSON.stringify({ success: true, lang, step, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[send-global-flow] error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
