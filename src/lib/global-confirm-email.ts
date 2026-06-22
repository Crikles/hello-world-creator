/**
 * Shared renderer for Global Payment Confirmation email.
 * Used by both the frontend preview and the Deno edge function
 * (a mirror copy lives at supabase/functions/_shared/global-confirm-email.ts).
 * Keep these two files identical (modulo runtime).
 */

export type GlobalLang = "en" | "es";

export interface GlobalConfirmTemplate {
  header: string;
  preview: string;
  greeting: string;     // supports {{nome}}
  intro: string;
  product_label: string;
  value_label: string;
  cta: string;
  footer: string;
  accent_color: string; // hex
}

export const GLOBAL_CONFIRM_DEFAULTS: Record<GlobalLang, GlobalConfirmTemplate> = {
  en: {
    header: "Payment Confirmed",
    preview: "Your international payment has been confirmed",
    greeting: "Hi {{nome}},",
    intro: "Your payment has been confirmed and your international order is now being processed.",
    product_label: "Product",
    value_label: "Amount",
    cta: "Track your order",
    footer: "Thank you for shopping with us.",
    accent_color: "#1e40af",
  },
  es: {
    header: "Pago Confirmado",
    preview: "Tu pago internacional ha sido confirmado",
    greeting: "Hola {{nome}},",
    intro: "Tu pago ha sido confirmado y tu pedido internacional está siendo procesado.",
    product_label: "Producto",
    value_label: "Valor",
    cta: "Rastrear pedido",
    footer: "Gracias por tu compra.",
    accent_color: "#1e40af",
  },
};

export interface GlobalConfirmVars {
  nome: string;
  produto: string;
  valor: string;
  empresa: string;
  origem: string;
  tracking_url: string;
}

function escapeHtml(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function interpolate(tpl: string, vars: GlobalConfirmVars): string {
  return tpl.replace(/\{\{\s*(nome|produto|valor|empresa|origem|tracking_url)\s*\}\}/g, (_, k) => String((vars as any)[k] ?? ""));
}

export function mergeTemplate(
  lang: GlobalLang,
  override?: Partial<GlobalConfirmTemplate> | null
): GlobalConfirmTemplate {
  const base = GLOBAL_CONFIRM_DEFAULTS[lang];
  if (!override) return { ...base };
  return {
    header: override.header || base.header,
    preview: override.preview || base.preview,
    greeting: override.greeting || base.greeting,
    intro: override.intro || base.intro,
    product_label: override.product_label || base.product_label,
    value_label: override.value_label || base.value_label,
    cta: override.cta || base.cta,
    footer: override.footer || base.footer,
    accent_color: override.accent_color || base.accent_color,
  };
}

export function renderGlobalConfirmEmail(
  lang: GlobalLang,
  template: GlobalConfirmTemplate,
  vars: GlobalConfirmVars
): string {
  const accent = template.accent_color || "#1e40af";
  const e = (s: string) => escapeHtml(interpolate(s, vars));
  const shippedFrom = lang === "es" ? "Enviado desde" : "Shipped from";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;">${e(template.preview)}</div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
  <tr><td style="padding:24px 32px 16px;border-bottom:2px solid ${accent};">
    <p style="margin:0;font-size:15px;font-weight:700;color:${accent};">${e(template.header)}</p>
    <p style="margin:2px 0 0;font-size:12px;color:#888;">${escapeHtml(vars.empresa)} · ${shippedFrom} ${escapeHtml(vars.origem)}</p>
  </td></tr>
  <tr><td style="padding:24px 32px 8px;">
    <p style="font-size:15px;color:#222;margin:0 0 8px;">${e(template.greeting)}</p>
    <p style="font-size:14px;color:#555;margin:0;">${e(template.intro)}</p>
  </td></tr>
  <tr><td style="padding:8px 32px;">
    <table width="100%" cellpadding="8" cellspacing="0" style="background:#f9f9f9;border-radius:6px;border:1px solid #eee;">
      <tr><td style="color:#666;font-size:13px;">${e(template.product_label)}</td><td style="color:#222;font-size:13px;font-weight:600;text-align:right;">${escapeHtml(vars.produto)}</td></tr>
      <tr><td style="color:#666;font-size:13px;border-top:1px solid #eee;">${e(template.value_label)}</td><td style="color:${accent};font-size:13px;font-weight:600;text-align:right;border-top:1px solid #eee;">R$ ${escapeHtml(vars.valor)}</td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:20px 32px;text-align:center;">
    <a href="${escapeHtml(vars.tracking_url)}" style="display:inline-block;background:${accent};color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">
      ${e(template.cta)}
    </a>
  </td></tr>
  <tr><td style="padding:20px 32px 24px;border-top:1px solid #eee;text-align:center;">
    <p style="font-size:12px;color:#999;margin:0;">${e(template.footer)}</p>
  </td></tr>
</table>
</td></tr></table></body></html>`;
}

export function getEmailSubject(lang: GlobalLang, template: GlobalConfirmTemplate): string {
  // subject mirrors header
  return template.header || GLOBAL_CONFIRM_DEFAULTS[lang].header;
}
