
-- Índices para acelerar agregações no histórico de confirmação
CREATE INDEX IF NOT EXISTS idx_cpl_loja_created ON public.confirmacao_pagamento_log (loja_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cpl_loja_pedido ON public.confirmacao_pagamento_log (loja_id, pedido_id);

-- RPC: retorna grupos agregados (1 linha por pedido/destinatário) com paginação
CREATE OR REPLACE FUNCTION public.get_confirmacao_grouped(
  p_loja_id uuid,
  p_search text DEFAULT '',
  p_status text DEFAULT 'todos',  -- todos | enviados | pendentes
  p_date text DEFAULT NULL,        -- YYYY-MM-DD
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE(
  group_key text,
  pedido_id uuid,
  nome text,
  email text,
  telefone text,
  email_status text,
  sms_status text,
  custo_total numeric,
  created_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search text := lower(coalesce(p_search, ''));
BEGIN
  RETURN QUERY
  WITH latest AS (
    SELECT DISTINCT ON (coalesce(pedido_id::text, destinatario), tipo)
      coalesce(pedido_id::text, destinatario) AS gkey,
      pedido_id,
      tipo,
      status,
      destinatario,
      custo,
      created_at
    FROM confirmacao_pagamento_log
    WHERE loja_id = p_loja_id
    ORDER BY coalesce(pedido_id::text, destinatario), tipo, created_at DESC
  ),
  totals AS (
    SELECT coalesce(pedido_id::text, destinatario) AS gkey, sum(custo) AS custo_total, max(created_at) AS created_at
    FROM confirmacao_pagamento_log
    WHERE loja_id = p_loja_id
    GROUP BY coalesce(pedido_id::text, destinatario)
  ),
  grouped AS (
    SELECT
      l.gkey,
      max(l.pedido_id) AS pedido_id,
      max(CASE WHEN l.tipo = 'email' THEN l.status END) AS email_status,
      max(CASE WHEN l.tipo = 'sms'   THEN l.status END) AS sms_status,
      max(CASE WHEN l.tipo = 'email' THEN l.destinatario END) AS email,
      max(CASE WHEN l.tipo = 'sms'   THEN l.destinatario END) AS telefone
    FROM latest l
    GROUP BY l.gkey
  ),
  enriched AS (
    SELECT
      g.gkey AS group_key,
      g.pedido_id,
      coalesce(p.customer_name, '-') AS nome,
      coalesce(p.customer_email, g.email, '') AS email,
      coalesce(p.customer_phone, g.telefone, '') AS telefone,
      coalesce(g.email_status, 'none') AS email_status,
      coalesce(g.sms_status, 'none') AS sms_status,
      t.custo_total,
      t.created_at
    FROM grouped g
    LEFT JOIN pedidos p ON p.id = g.pedido_id
    LEFT JOIN totals t ON t.gkey = g.gkey
  ),
  filtered AS (
    SELECT * FROM enriched e
    WHERE
      (p_status = 'todos'
        OR (p_status = 'pendentes' AND (e.email_status = 'failed' OR e.sms_status = 'failed'))
        OR (p_status = 'enviados' AND e.email_status <> 'failed' AND e.sms_status <> 'failed'
            AND (e.email_status = 'sent' OR e.sms_status = 'sent'))
      )
      AND (v_search = '' OR lower(e.nome) LIKE '%'||v_search||'%'
           OR lower(e.email) LIKE '%'||v_search||'%'
           OR e.telefone LIKE '%'||v_search||'%')
      AND (p_date IS NULL OR p_date = '' OR to_char(e.created_at, 'YYYY-MM-DD') = p_date)
  ),
  counted AS (
    SELECT count(*) AS total_count FROM filtered
  )
  SELECT f.group_key, f.pedido_id, f.nome, f.email, f.telefone,
         f.email_status, f.sms_status, f.custo_total, f.created_at,
         (SELECT total_count FROM counted)
  FROM filtered f
  ORDER BY f.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- RPC para placar (contadores) sem trazer linhas
CREATE OR REPLACE FUNCTION public.get_confirmacao_placar(p_loja_id uuid)
RETURNS TABLE(enviados bigint, pendentes bigint, total bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
  )
  SELECT
    count(*) FILTER (WHERE email_status <> 'failed' AND sms_status IS DISTINCT FROM 'failed'
                     AND (email_status = 'sent' OR sms_status = 'sent')) AS enviados,
    count(*) FILTER (WHERE email_status = 'failed' OR sms_status = 'failed') AS pendentes,
    count(*) AS total
  FROM grouped;
$$;
