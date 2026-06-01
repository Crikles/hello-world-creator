
CREATE OR REPLACE FUNCTION public.get_confirmacao_grouped(p_loja_id uuid, p_search text DEFAULT ''::text, p_status text DEFAULT 'todos'::text, p_date text DEFAULT NULL::text, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
 RETURNS TABLE(group_key text, pedido_id uuid, nome text, email text, telefone text, email_status text, sms_status text, custo_total numeric, created_at timestamp with time zone, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_search text := lower(coalesce(p_search, ''));
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      coalesce(c.pedido_id::text, c.destinatario) AS gkey,
      c.pedido_id,
      c.tipo,
      c.status,
      c.destinatario,
      c.custo,
      c.created_at,
      row_number() OVER (
        PARTITION BY coalesce(c.pedido_id::text, c.destinatario), c.tipo
        ORDER BY c.created_at DESC
      ) AS rn
    FROM confirmacao_pagamento_log c
    WHERE c.loja_id = p_loja_id
  ),
  totals AS (
    SELECT b.gkey, sum(b.custo) AS custo_total, max(b.created_at) AS last_at
    FROM base b
    GROUP BY b.gkey
  ),
  latest AS (
    SELECT * FROM base WHERE rn = 1
  ),
  grouped AS (
    SELECT
      l.gkey,
      max(l.pedido_id::text) AS pid_text,
      max(CASE WHEN l.tipo='email' THEN l.status END) AS email_st,
      max(CASE WHEN l.tipo='sms'   THEN l.status END) AS sms_st,
      max(CASE WHEN l.tipo='email' THEN l.destinatario END) AS email_dst,
      max(CASE WHEN l.tipo='sms'   THEN l.destinatario END) AS tel_dst
    FROM latest l
    GROUP BY l.gkey
  ),
  enriched AS (
    SELECT
      g.gkey AS gk,
      CASE WHEN g.pid_text ~ '^[0-9a-f]{8}-' THEN g.pid_text::uuid ELSE NULL END AS pid,
      coalesce(p.customer_name, '-') AS nm,
      coalesce(p.customer_email, g.email_dst, '') AS em,
      coalesce(p.customer_phone, g.tel_dst, '') AS tel,
      coalesce(g.email_st, 'none') AS est,
      coalesce(g.sms_st, 'none') AS sst,
      t.custo_total AS ct,
      t.last_at AS la,
      -- status unificado: prioriza e-mail, igual ao placar e ao badge da UI
      CASE
        WHEN g.email_st = 'sent'   THEN 'sent'
        WHEN g.email_st = 'failed' THEN 'failed'
        WHEN g.email_st IS NULL AND g.sms_st = 'sent'   THEN 'sent'
        WHEN g.email_st IS NULL AND g.sms_st = 'failed' THEN 'failed'
        ELSE 'none'
      END AS unified_status
    FROM grouped g
    LEFT JOIN totals t ON t.gkey = g.gkey
    LEFT JOIN pedidos p
      ON g.pid_text ~ '^[0-9a-f]{8}-'
     AND p.id = g.pid_text::uuid
     AND p.loja_id = p_loja_id
  ),
  filtered AS (
    SELECT
      e.*,
      count(*) OVER () AS tc
    FROM enriched e
    WHERE
      (p_status = 'todos'
        OR (p_status = 'pendentes' AND e.unified_status = 'failed')
        OR (p_status = 'enviados'  AND e.unified_status = 'sent'))
      AND (v_search = ''
        OR lower(e.nm) LIKE '%'||v_search||'%'
        OR lower(e.em) LIKE '%'||v_search||'%'
        OR e.tel LIKE '%'||v_search||'%')
      AND (p_date IS NULL OR p_date = ''
        OR to_char(e.la, 'YYYY-MM-DD') = p_date)
  )
  SELECT
    f.gk, f.pid, f.nm, f.em, f.tel,
    f.est, f.sst, f.ct, f.la, f.tc
  FROM filtered f
  ORDER BY f.la DESC NULLS LAST
  LIMIT p_limit OFFSET p_offset;
END;
$function$;
