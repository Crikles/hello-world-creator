
CREATE OR REPLACE FUNCTION public._build_postagem_email_html(
  p_event text,
  p_mensagem text,
  p_cta_text text,
  p_cta_url text,
  p_is_final boolean
) RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_emoji text;
  v_title text;
  v_header text;
  v_rodape text;
  v_msg_html text;
  v_cta text := '';
BEGIN
  v_emoji := CASE p_event
    WHEN 'Postado' THEN '📄' WHEN 'Coletado' THEN '📦'
    WHEN 'Em Trânsito' THEN '🚛' WHEN 'Em Rota' THEN '🏍️'
    WHEN 'Centro Local' THEN '📍' WHEN 'Saiu para Entrega' THEN '🚚'
    WHEN 'Entregue' THEN '✅' WHEN 'Taxação' THEN '⚠️'
    WHEN 'Pago' THEN '💳' WHEN 'Falha Entrega' THEN '⚠️'
    ELSE '📬' END;
  v_title := CASE p_event
    WHEN 'Postado' THEN 'Pedido Postado' WHEN 'Coletado' THEN 'Pedido Coletado'
    WHEN 'Em Trânsito' THEN 'Pedido em Trânsito' WHEN 'Em Rota' THEN 'Em Rota de Entrega'
    WHEN 'Centro Local' THEN 'Centro de Distribuição' WHEN 'Saiu para Entrega' THEN 'Saiu para Entrega!'
    WHEN 'Entregue' THEN 'Pedido Entregue!' WHEN 'Taxação' THEN 'Aviso de Taxação'
    WHEN 'Pago' THEN 'Pagamento Confirmado' WHEN 'Falha Entrega' THEN 'Falha na Entrega'
    ELSE p_event END;
  v_header := v_emoji || ' ' || v_title;
  v_rodape := CASE WHEN p_is_final THEN 'Obrigado pela preferência!<br>{{empresa_nome}}' ELSE 'Atenciosamente,<br>{{empresa_nome}}' END;
  v_msg_html := replace(replace(p_mensagem, E'\n', '<br>'), '**', '');
  -- Convert markdown **x** properly
  v_msg_html := regexp_replace(replace(p_mensagem, E'\n', '<br>'), '\*\*(.*?)\*\*', '<strong>\1</strong>', 'g');

  IF p_cta_text <> '' AND p_cta_text IS NOT NULL THEN
    v_cta := '<table width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0 8px;"><tr><td align="center" style="text-align:center;"><a href="' || COALESCE(NULLIF(p_cta_url,''),'#') || '" style="display:inline-block;background-color:#1a1a1a;color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:50px;font-size:15px;font-weight:700;letter-spacing:0.5px;box-shadow:0 4px 14px rgba(0,0,0,0.2);text-align:center;">' || p_cta_text || '</a></td></tr></table>';
  END IF;

  RETURN '<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f0f0f0;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,''Helvetica Neue'',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f0f0;padding:40px 0;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
<tr><td style="background-color:#f5f5f5;padding:36px 40px 20px;text-align:center;">{{#empresa_logo_url}}<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 16px;"><tr><td style="width:90px;height:90px;border-radius:50%;background:#ffffff;text-align:center;vertical-align:middle;box-shadow:0 4px 12px rgba(0,0,0,0.15);overflow:hidden;"><img src="{{empresa_logo_url}}" alt="{{empresa_nome}}" style="width:90px;height:90px;object-fit:cover;border-radius:50%;display:block;" /></td></tr></table>{{/empresa_logo_url}}<p style="margin:0;color:#666;font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">{{empresa_nome}}</p></td></tr>
<tr><td style="background-color:#1a1a1a;padding:28px 40px;text-align:center;"><p style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.3px;">' || v_header || '</p></td></tr>
<tr><td style="padding:36px 40px;"><p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#333;">Olá {{cliente_primeiro_nome}},</p><div style="margin:0 0 8px;font-size:15px;line-height:1.8;color:#555;">' || v_msg_html || '</div><table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;"><tr style="background-color:#fafafa;"><td style="padding:14px 18px;font-size:13px;color:#888;border-bottom:1px solid #f0f0f0;width:140px;">📦 Produto</td><td style="padding:14px 18px;font-size:14px;font-weight:600;color:#1a1a1a;border-bottom:1px solid #f0f0f0;">{{produto}}</td></tr><tr><td style="padding:14px 18px;font-size:13px;color:#888;border-bottom:1px solid #f0f0f0;">🔍 Rastreio</td><td style="padding:14px 18px;font-size:14px;font-weight:700;color:#6366f1;border-bottom:1px solid #f0f0f0;letter-spacing:0.5px;">{{codigo_rastreio}}</td></tr><tr style="background-color:#fafafa;"><td style="padding:14px 18px;font-size:13px;color:#888;border-bottom:1px solid #f0f0f0;">🚛 Transportadora</td><td style="padding:14px 18px;font-size:14px;font-weight:600;color:#1a1a1a;border-bottom:1px solid #f0f0f0;">{{transportadora}}</td></tr><tr><td style="padding:14px 18px;font-size:13px;color:#888;">💰 Valor</td><td style="padding:14px 18px;font-size:14px;font-weight:700;color:#1a1a1a;">R$ {{valor}}</td></tr></table>' || v_cta || '</td></tr>
<tr><td style="padding:24px 40px;background-color:#fafafa;border-top:1px solid #eee;"><p style="margin:0;font-size:12px;line-height:1.5;color:#aaa;text-align:center;">' || v_rodape || '</p></td></tr>
</table></td></tr></table></body></html>';
END;
$$;
