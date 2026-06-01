
-- Chunk 4: confirmacao_pagamento_config, referrals, checkout_id, proximo_avanco_em, RPCs

-- 1. confirmacao_pagamento_config
CREATE TABLE IF NOT EXISTS public.confirmacao_pagamento_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT false,
  enviar_email BOOLEAN NOT NULL DEFAULT true,
  enviar_sms BOOLEAN NOT NULL DEFAULT false,
  assunto_email TEXT NOT NULL DEFAULT 'Pagamento confirmado',
  sms_template TEXT NOT NULL DEFAULT '',
  corpo_email TEXT NOT NULL DEFAULT '',
  email_remetente_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.confirmacao_pagamento_config TO authenticated;
GRANT ALL ON public.confirmacao_pagamento_config TO service_role;
ALTER TABLE public.confirmacao_pagamento_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own loja confirmacao_config" ON public.confirmacao_pagamento_config
  FOR ALL USING (user_owns_loja(auth.uid(), loja_id)) WITH CHECK (user_owns_loja(auth.uid(), loja_id));

-- 2. Referrals on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by UUID;

-- 3. checkout_id on checkout_integrations + unique
ALTER TABLE public.checkout_integrations
  ADD COLUMN IF NOT EXISTS checkout_id TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'checkout_integrations_loja_checkout_unique') THEN
    ALTER TABLE public.checkout_integrations
      ADD CONSTRAINT checkout_integrations_loja_checkout_unique UNIQUE (loja_id, checkout_id);
  END IF;
END $$;

-- 4. proximo_avanco_em on envios
ALTER TABLE public.envios
  ADD COLUMN IF NOT EXISTS proximo_avanco_em TIMESTAMPTZ;

-- 5. RPCs
CREATE OR REPLACE FUNCTION public.get_loja_faturamento(p_loja_id UUID)
RETURNS NUMERIC LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(valor), 0)::numeric FROM envios
  WHERE loja_id = p_loja_id AND deleted_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.get_loja_chart_data(p_loja_id UUID)
RETURNS TABLE(dia TEXT, receita NUMERIC, pedidos NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS dia,
         COALESCE(SUM(valor),0)::numeric AS receita,
         COUNT(*)::numeric AS pedidos
  FROM envios
  WHERE loja_id = p_loja_id AND deleted_at IS NULL
    AND created_at > now() - interval '30 days'
  GROUP BY 1 ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.get_envios_stats(p_loja_id UUID)
RETURNS TABLE(total BIGINT, pendentes BIGINT, em_transito BIGINT, entregues BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::bigint,
         COUNT(*) FILTER (WHERE status='pendente')::bigint,
         COUNT(*) FILTER (WHERE status IN ('em_transito','saiu_para_entrega'))::bigint,
         COUNT(*) FILTER (WHERE status='entregue')::bigint
  FROM envios WHERE loja_id = p_loja_id AND deleted_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.get_envios_paginated(
  p_loja_id UUID, p_search TEXT DEFAULT '', p_status TEXT DEFAULT 'todos',
  p_metodo TEXT DEFAULT 'todos', p_origem TEXT DEFAULT 'todos',
  p_date_from TIMESTAMPTZ DEFAULT NULL, p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_page INT DEFAULT 1, p_per_page INT DEFAULT 50
) RETURNS SETOF JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_search TEXT := lower(coalesce(p_search,''));
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT e.*, p.method AS metodo, p.checkout_provider AS origem,
           COUNT(*) OVER () AS total_count
    FROM envios e
    LEFT JOIN pedidos p ON p.envio_id = e.id
    WHERE e.loja_id = p_loja_id AND e.deleted_at IS NULL
      AND (p_status = 'todos' OR e.status::text = p_status)
      AND (p_metodo = 'todos' OR lower(coalesce(p.method,'')) LIKE '%'||lower(p_metodo)||'%')
      AND (p_origem = 'todos' OR p.checkout_provider = p_origem)
      AND (p_date_from IS NULL OR e.created_at >= p_date_from)
      AND (p_date_to IS NULL OR e.created_at <= p_date_to)
      AND (v_search = '' OR lower(e.cliente_nome) LIKE '%'||v_search||'%'
           OR lower(coalesce(e.cliente_email,'')) LIKE '%'||v_search||'%'
           OR lower(coalesce(e.codigo_rastreio,'')) LIKE '%'||v_search||'%'
           OR lower(coalesce(e.produto,'')) LIKE '%'||v_search||'%')
    ORDER BY e.created_at DESC
    LIMIT p_per_page OFFSET (GREATEST(p_page,1)-1) * p_per_page
  )
  SELECT to_jsonb(base.*) FROM base;
END $$;

-- 6. Default costs for confirmation flow
INSERT INTO public.system_config(key, value) VALUES
  ('custo_confirmacao_email', 1),
  ('custo_confirmacao_sms', 0.15)
ON CONFLICT (key) DO NOTHING;
