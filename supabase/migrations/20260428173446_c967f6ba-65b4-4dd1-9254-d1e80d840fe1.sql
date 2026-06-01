CREATE OR REPLACE FUNCTION public.get_confirmacao_placar(p_loja_id uuid)
 RETURNS TABLE(enviados bigint, pendentes bigint, total bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH latest AS (
    SELECT DISTINCT ON (coalesce(pedido_id::text, destinatario), tipo)
      coalesce(pedido_id::text, destinatario) AS gkey,
      tipo, status
    FROM confirmacao_pagamento_log
    WHERE loja_id = p_loja_id
    ORDER BY coalesce(pedido_id::text, destinatario), tipo, created_at DESC
  ),
  grouped AS (
    SELECT
      gkey,
      max(CASE WHEN tipo='email' THEN status END) AS email_status,
      max(CASE WHEN tipo='sms'   THEN status END) AS sms_status
    FROM latest GROUP BY gkey
  ),
  unified AS (
    SELECT
      gkey,
      CASE
        WHEN email_status = 'sent'   THEN 'sent'
        WHEN email_status = 'failed' THEN 'failed'
        WHEN email_status IS NULL AND sms_status = 'sent' THEN 'sent'
        ELSE 'none'
      END AS final_status
    FROM grouped
  )
  SELECT
    count(*) FILTER (WHERE final_status = 'sent')   AS enviados,
    count(*) FILTER (WHERE final_status = 'failed') AS pendentes,
    count(*) AS total
  FROM unified;
$function$;