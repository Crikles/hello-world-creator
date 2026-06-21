import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Lang = "en" | "es";

const STEPS: Record<Lang, string[]> = {
  en: [
    "Order Received",
    "Order Prepared",
    "Shipped by Sender",
    "Left Country of Origin",
    "In International Transit",
    "Arrived at Destination Country",
    "In Customs Processing",
    "In Local Transit",
    "Out for Delivery",
    "Delivered",
  ],
  es: [
    "Pedido Recibido",
    "Pedido Preparado",
    "Enviado por el Remitente",
    "Salió del País de Origen",
    "En Tránsito Internacional",
    "Llegó al País de Destino",
    "En Procesamiento Aduanero",
    "En Tránsito Local",
    "Salió para Entrega",
    "Entregado",
  ],
};

const I18N = {
  en: {
    subject: (step: string) => `Order update: ${step}`,
    preview: "Your international shipment progress",
    hi: (n: string) => `Hi ${n},`,
    intro: "Here is the latest update on your international shipment:",
    trackBtn: "Track your order",
    footer: "Thank you for shopping with us.",
    sms: (n: string, step: string, link: string) =>
      `${n}, your order status: ${step}. Track: ${link}`,
  },
  es: {
    subject: (step: string) => `Actualización del pedido: ${step}`,
    preview: "Progreso de tu envío internacional",
    hi: (n: string) => `Hola ${n},`,
    intro: "Esta es la última actualización de tu envío internacional:",
    trackBtn: "Rastrear pedido",
    footer: "Gracias por tu compra.",
    sms: (n: string, step: string, link: string) =>
      `${n}, estado de tu pedido: ${step}. Rastrear: ${link}`,
  },
} as const;

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

function buildEmailHtml(lang: Lang, currentStep: number, name: string, link: string, empresaNome: string): string {
  const t = I18N[lang];
  const steps = STEPS[lang];
  const accent = "#1e40af";
  const done = "#16a34a";
  const muted = "#9ca3af";

  const stepsHtml = steps
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

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(t.preview)}</div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
  <tr><td style="padding:24px 32px 16px;border-bottom:2px solid ${accent};">
    <p style="margin:0;font-size:15px;font-weight:700;color:${accent};">${escapeHtml(STEPS[lang][currentStep - 1] || "")}</p>
    <p style="margin:2px 0 0;font-size:12px;color:#888;">${escapeHtml(empresaNome)}</p>
  </td></tr>
  <tr><td style="padding:24px 32px 8px;">
    <p style="font-size:15px;color:#222;margin:0 0 8px;">${escapeHtml(t.hi(name))}</p>
    <p style="font-size:14px;color:#555;margin:0;">${escapeHtml(t.intro)}</p>
  </td></tr>
  <tr><td style="padding:8px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:6px;border:1px solid #eee;padding:12px 16px;">
      ${stepsHtml}
    </table>
  </td></tr>
  <tr><td style="padding:20px 32px;text-align:center;">
    <a href="${escapeHtml(link)}" style="display:inline-block;background:${accent};color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">
      ${escapeHtml(t.trackBtn)}
    </a>
  </td></tr>
  <tr><td style="padding:20px 32px 24px;border-top:1px solid #eee;text-align:center;">
    <p style="font-size:12px;color:#999;margin:0;">${escapeHtml(t.footer)}</p>
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
      .select("id, loja_id, cliente_nome, cliente_email, cliente_telefone, codigo_rastreio, is_international, global_flow_lang")
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
    const t = I18N[lang];
    const stepLabel = STEPS[lang][step - 1];
    const firstName = (envio.cliente_nome || "Customer").split(" ")[0];
    const link = `https://atlas-cargo.org/r/${envio.codigo_rastreio || ""}`;

    const { data: loja } = await supabase.from("lojas").select("user_id").eq("id", envio.loja_id).single();
    const { data: empresa } = await supabase
      .from("empresas")
      .select("nome_fantasia, razao_social")
      .eq("loja_id", envio.loja_id)
      .maybeSingle();
    const empresaNome = empresa?.nome_fantasia || empresa?.razao_social || "";

    const { data: custos } = await supabase
      .from("system_config")
      .select("key, value")
      .in("key", ["custo_email_rastreio", "custo_sms"]);
    const custoMap: Record<string, number> = {};
    (custos || []).forEach((c: any) => { custoMap[c.key] = c.value; });
    const custoEmail = custoMap["custo_email_rastreio"] ?? 1;
    const custoSms = custoMap["custo_sms"] ?? 0.12;

    const results: { email?: string; sms?: string } = {};

    // EMAIL
    if (config.enviar_email && envio.cliente_email && loja?.user_id) {
      const resendKey = Deno.env.get("RESEND_TRACKING_API_KEY") || Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        const { data: debited } = await supabase.rpc("debit_user_credits", {
          _user_id: loja.user_id,
          _quantidade: custoEmail,
          _descricao: `Global flow email step ${step} - ${envio.cliente_email}`,
        });
        if (debited) {
          const html = buildEmailHtml(lang, step, firstName, link, empresaNome);
          const fromName = empresaNome || "Tracking";
          const from = `${fromName} <contato@recuperacaodenegocios.com>`;
          try {
            const r = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
              body: JSON.stringify({
                from,
                to: [envio.cliente_email],
                subject: t.subject(stepLabel),
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
          const message = removeAccents(t.sms(firstName, stepLabel, link));
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
