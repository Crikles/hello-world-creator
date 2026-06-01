
-- Columns
ALTER TABLE public.postagem_config
  ADD COLUMN IF NOT EXISTS ativar_taxacao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ativar_falha_entrega boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ativar_site_rastreio boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checkout_url_falha text,
  ADD COLUMN IF NOT EXISTS valor_taxa_falha numeric DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS custom_prices jsonb DEFAULT '{}'::jsonb;

-- live_view_pings
CREATE TABLE IF NOT EXISTS public.live_view_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL,
  session_id text NOT NULL,
  codigo_rastreio text,
  cidade text, estado text, pais text, pais_codigo text,
  lat numeric, lng numeric,
  user_agent text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS live_view_pings_session_codigo_uniq
  ON public.live_view_pings (session_id, COALESCE(codigo_rastreio, ''));
CREATE INDEX IF NOT EXISTS live_view_pings_loja_lastseen_idx
  ON public.live_view_pings (loja_id, last_seen_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_view_pings TO authenticated;
GRANT SELECT, INSERT ON public.live_view_pings TO anon;
GRANT ALL ON public.live_view_pings TO service_role;

ALTER TABLE public.live_view_pings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service manage live_view_pings" ON public.live_view_pings;
CREATE POLICY "Service manage live_view_pings" ON public.live_view_pings FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Public insert live_view_pings" ON public.live_view_pings;
CREATE POLICY "Public insert live_view_pings" ON public.live_view_pings FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Public update live_view_pings" ON public.live_view_pings;
CREATE POLICY "Public update live_view_pings" ON public.live_view_pings FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Users view own loja live_view_pings" ON public.live_view_pings;
CREATE POLICY "Users view own loja live_view_pings" ON public.live_view_pings FOR SELECT
  USING (public.user_owns_loja(auth.uid(), loja_id));

-- retry_execucoes
CREATE TABLE IF NOT EXISTS public.retry_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'running',
  total_pendentes integer NOT NULL DEFAULT 0,
  processados integer NOT NULL DEFAULT 0,
  sucesso integer NOT NULL DEFAULT 0,
  falhas integer NOT NULL DEFAULT 0,
  mensagem text,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes')
);
CREATE INDEX IF NOT EXISTS idx_retry_execucoes_loja_status
  ON public.retry_execucoes (loja_id, status, expires_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.retry_execucoes TO authenticated;
GRANT ALL ON public.retry_execucoes TO service_role;

ALTER TABLE public.retry_execucoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own loja retry_execucoes" ON public.retry_execucoes;
CREATE POLICY "Users view own loja retry_execucoes" ON public.retry_execucoes FOR SELECT
  USING (public.user_owns_loja(auth.uid(), loja_id));
DROP POLICY IF EXISTS "Service role manage retry_execucoes" ON public.retry_execucoes;
CREATE POLICY "Service role manage retry_execucoes" ON public.retry_execucoes FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Admins full access retry_execucoes" ON public.retry_execucoes;
CREATE POLICY "Admins full access retry_execucoes" ON public.retry_execucoes FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- confirmacao_pagamento_log
CREATE TABLE IF NOT EXISTS public.confirmacao_pagamento_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL,
  pedido_id uuid,
  tipo text NOT NULL DEFAULT 'email',
  status text NOT NULL DEFAULT 'pending',
  custo numeric NOT NULL DEFAULT 0,
  destinatario text NOT NULL,
  error_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cpl_loja_created ON public.confirmacao_pagamento_log(loja_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.confirmacao_pagamento_log TO authenticated;
GRANT ALL ON public.confirmacao_pagamento_log TO service_role;

ALTER TABLE public.confirmacao_pagamento_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own loja cpl" ON public.confirmacao_pagamento_log;
CREATE POLICY "Users view own loja cpl" ON public.confirmacao_pagamento_log FOR SELECT
  USING (public.user_owns_loja(auth.uid(), loja_id));
DROP POLICY IF EXISTS "Service role manage cpl" ON public.confirmacao_pagamento_log;
CREATE POLICY "Service role manage cpl" ON public.confirmacao_pagamento_log FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- RPCs
CREATE OR REPLACE FUNCTION public.debit_user_credits(_user_id uuid, _quantidade numeric, _descricao text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_saldo numeric;
BEGIN
  SELECT saldo INTO current_saldo FROM creditos WHERE user_id = _user_id FOR UPDATE;
  IF current_saldo IS NULL OR current_saldo < _quantidade THEN RETURN FALSE; END IF;
  UPDATE creditos SET saldo = saldo - _quantidade, updated_at = now() WHERE user_id = _user_id;
  INSERT INTO creditos_transacoes (user_id, tipo, quantidade, descricao)
  VALUES (_user_id, 'consumo', _quantidade::integer, _descricao);
  RETURN TRUE;
END $$;

CREATE OR REPLACE FUNCTION public.get_confirmacao_placar(p_loja_id uuid)
RETURNS TABLE(enviados bigint, pendentes bigint, total bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH latest AS (
    SELECT DISTINCT ON (coalesce(pedido_id::text, destinatario), tipo)
      coalesce(pedido_id::text, destinatario) AS gkey, tipo, status
    FROM confirmacao_pagamento_log WHERE loja_id = p_loja_id
    ORDER BY coalesce(pedido_id::text, destinatario), tipo, created_at DESC
  ),
  grouped AS (
    SELECT gkey,
      max(CASE WHEN tipo='email' THEN status END) AS email_status,
      max(CASE WHEN tipo='sms' THEN status END) AS sms_status
    FROM latest GROUP BY gkey
  ),
  unified AS (
    SELECT gkey,
      CASE WHEN email_status='sent' THEN 'sent'
           WHEN email_status='failed' THEN 'failed'
           WHEN email_status IS NULL AND sms_status='sent' THEN 'sent'
           ELSE 'none' END AS final_status
    FROM grouped
  )
  SELECT count(*) FILTER (WHERE final_status='sent'),
         count(*) FILTER (WHERE final_status='failed'),
         count(*) FROM unified;
$$;

CREATE OR REPLACE FUNCTION public.get_confirmacao_grouped(
  p_loja_id uuid, p_search text DEFAULT '', p_status text DEFAULT 'todos',
  p_date text DEFAULT NULL, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
RETURNS TABLE(group_key text, pedido_id uuid, nome text, email text, telefone text,
              email_status text, sms_status text, custo_total numeric,
              created_at timestamptz, total_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_search text := lower(coalesce(p_search,''));
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT coalesce(c.pedido_id::text, c.destinatario) AS gkey,
      c.pedido_id, c.tipo, c.status, c.destinatario, c.custo, c.created_at,
      row_number() OVER (PARTITION BY coalesce(c.pedido_id::text, c.destinatario), c.tipo
                         ORDER BY c.created_at DESC) AS rn
    FROM confirmacao_pagamento_log c WHERE c.loja_id = p_loja_id
  ),
  totals AS (SELECT b.gkey, sum(b.custo) AS custo_total, max(b.created_at) AS last_at FROM base b GROUP BY b.gkey),
  latest AS (SELECT * FROM base WHERE rn=1),
  grouped AS (
    SELECT l.gkey, max(l.pedido_id::text) AS pid_text,
      max(CASE WHEN l.tipo='email' THEN l.status END) AS email_st,
      max(CASE WHEN l.tipo='sms' THEN l.status END) AS sms_st,
      max(CASE WHEN l.tipo='email' THEN l.destinatario END) AS email_dst,
      max(CASE WHEN l.tipo='sms' THEN l.destinatario END) AS tel_dst
    FROM latest l GROUP BY l.gkey
  ),
  enriched AS (
    SELECT g.gkey AS gk,
      CASE WHEN g.pid_text ~ '^[0-9a-f]{8}-' THEN g.pid_text::uuid ELSE NULL END AS pid,
      coalesce(p.customer_name,'-') AS nm,
      coalesce(p.customer_email, g.email_dst, '') AS em,
      coalesce(p.customer_phone, g.tel_dst, '') AS tel,
      coalesce(g.email_st,'none') AS est, coalesce(g.sms_st,'none') AS sst,
      t.custo_total AS ct, t.last_at AS la,
      CASE WHEN g.email_st='sent' THEN 'sent'
           WHEN g.email_st='failed' THEN 'failed'
           WHEN g.email_st IS NULL AND g.sms_st='sent' THEN 'sent'
           WHEN g.email_st IS NULL AND g.sms_st='failed' THEN 'failed'
           ELSE 'none' END AS unified_status
    FROM grouped g LEFT JOIN totals t ON t.gkey=g.gkey
    LEFT JOIN pedidos p ON g.pid_text ~ '^[0-9a-f]{8}-'
      AND p.id = g.pid_text::uuid AND p.loja_id = p_loja_id
  ),
  filtered AS (
    SELECT e.*, count(*) OVER () AS tc FROM enriched e
    WHERE (p_status='todos'
        OR (p_status='pendentes' AND e.unified_status='failed')
        OR (p_status='enviados' AND e.unified_status='sent'))
      AND (v_search='' OR lower(e.nm) LIKE '%'||v_search||'%'
           OR lower(e.em) LIKE '%'||v_search||'%' OR e.tel LIKE '%'||v_search||'%')
      AND (p_date IS NULL OR p_date='' OR to_char(e.la,'YYYY-MM-DD')=p_date)
  )
  SELECT f.gk, f.pid, f.nm, f.em, f.tel, f.est, f.sst, f.ct, f.la, f.tc
  FROM filtered f ORDER BY f.la DESC NULLS LAST LIMIT p_limit OFFSET p_offset;
END $$;
