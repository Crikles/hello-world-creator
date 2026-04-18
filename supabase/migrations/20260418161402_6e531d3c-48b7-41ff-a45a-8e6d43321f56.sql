CREATE OR REPLACE FUNCTION public.get_confirmacao_grouped(
  p_loja_id uuid,
  p_search text DEFAULT '',
  p_status text DEFAULT 'todos',
  p_date text DEFAULT NULL,
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE(
  group_key text, pedido_id uuid, nome text, email text, telefone text,
  email_status text, sms_status text, custo_total numeric,
  created_at timestamptz, total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_search text := lower(coalesce(p_search, ''));
BEGIN
  RETURN QUERY
  WITH latest AS (
    SELECT DISTINCT ON (coalesce(c.pedido_id::text, c.destinatario), c.tipo)
      coalesce(c.pedido_id::text, c.destinatario) AS gkey,
      c.pedido_id AS pid, c.tipo, c.status, c.destinatario, c.custo, c.created_at
    FROM confirmacao_pagamento_log c
    WHERE c.loja_id = p_loja_id
    ORDER BY coalesce(c.pedido_id::text, c.destinatario), c.tipo, c.created_at DESC
  ),
  totals AS (
    SELECT coalesce(c.pedido_id::text, c.destinatario) AS gkey,
           sum(c.custo) AS custo_total, max(c.created_at) AS created_at
    FROM confirmacao_pagamento_log c
    WHERE c.loja_id = p_loja_id
    GROUP BY coalesce(c.pedido_id::text, c.destinatario)
  ),
  grouped AS (
    SELECT l.gkey,
      max(l.pid) AS pid,
      max(CASE WHEN l.tipo='email' THEN l.status END) AS email_status,
      max(CASE WHEN l.tipo='sms'   THEN l.status END) AS sms_status,
      max(CASE WHEN l.tipo='email' THEN l.destinatario END) AS email,
      max(CASE WHEN l.tipo='sms'   THEN l.destinatario END) AS telefone
    FROM latest l GROUP BY l.gkey
  ),
  enriched AS (
    SELECT g.gkey AS group_key, g.pid AS pedido_id,
      coalesce(p.customer_name, '-') AS nome,
      coalesce(p.customer_email, g.email, '') AS email,
      coalesce(p.customer_phone, g.telefone, '') AS telefone,
      coalesce(g.email_status, 'none') AS email_status,
      coalesce(g.sms_status, 'none') AS sms_status,
      t.custo_total, t.created_at
    FROM grouped g
    LEFT JOIN pedidos p ON p.id = g.pid
    LEFT JOIN totals t ON t.gkey = g.gkey
  ),
  filtered AS (
    SELECT * FROM enriched e
    WHERE (p_status='todos'
      OR (p_status='pendentes' AND (e.email_status='failed' OR e.sms_status='failed'))
      OR (p_status='enviados' AND e.email_status<>'failed' AND e.sms_status<>'failed'
          AND (e.email_status='sent' OR e.sms_status='sent')))
      AND (v_search='' OR lower(e.nome) LIKE '%'||v_search||'%'
           OR lower(e.email) LIKE '%'||v_search||'%'
           OR e.telefone LIKE '%'||v_search||'%')
      AND (p_date IS NULL OR p_date='' OR to_char(e.created_at,'YYYY-MM-DD')=p_date)
  ),
  counted AS (SELECT count(*) AS total_count FROM filtered)
  SELECT f.group_key, f.pedido_id, f.nome, f.email, f.telefone,
         f.email_status, f.sms_status, f.custo_total, f.created_at,
         (SELECT total_count FROM counted)
  FROM filtered f
  ORDER BY f.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;