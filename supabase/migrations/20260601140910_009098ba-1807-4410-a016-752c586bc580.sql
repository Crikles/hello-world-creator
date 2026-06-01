-- 1. profiles.blocked
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS blocked BOOLEAN NOT NULL DEFAULT false;

-- 2. envios: deleted_at + ultimo_evento_ordem
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS ultimo_evento_ordem INTEGER NOT NULL DEFAULT 0;

-- 3. postagem_config: auto_envio + textos personalizados
ALTER TABLE public.postagem_config ADD COLUMN IF NOT EXISTS auto_envio BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.postagem_config ADD COLUMN IF NOT EXISTS msg_falha_entrega TEXT;
ALTER TABLE public.postagem_config ADD COLUMN IF NOT EXISTS msg_taxacao TEXT;

-- 4. checkout_integrations.filtro_metodo
ALTER TABLE public.checkout_integrations ADD COLUMN IF NOT EXISTS filtro_metodo TEXT NOT NULL DEFAULT 'todos';

-- 5. leads.loja_id
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS loja_id UUID REFERENCES public.lojas(id) ON DELETE SET NULL;

-- 6. system_config: converte value para NUMERIC (era JSONB; recriar)
DROP TABLE IF EXISTS public.system_config CASCADE;
CREATE TABLE public.system_config (
  key TEXT PRIMARY KEY,
  value NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.system_config TO anon, authenticated;
GRANT ALL ON public.system_config TO service_role;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read system_config" ON public.system_config FOR SELECT USING (true);
CREATE POLICY "Admins manage system_config" ON public.system_config FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.system_config (key, value) VALUES
  ('custo_email_rastreio', 1),
  ('custo_nfe_email', 0.5)
ON CONFLICT (key) DO NOTHING;

-- 7. batch_progress
CREATE TABLE IF NOT EXISTS public.batch_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID NOT NULL UNIQUE REFERENCES public.lojas(id) ON DELETE CASCADE,
  current_item INTEGER NOT NULL DEFAULT 0,
  total_items INTEGER NOT NULL DEFAULT 0,
  cancelled BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.batch_progress TO authenticated;
GRANT ALL ON public.batch_progress TO service_role;
ALTER TABLE public.batch_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own loja batch_progress" ON public.batch_progress FOR ALL
  USING (public.user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (public.user_owns_loja(auth.uid(), loja_id));

ALTER PUBLICATION supabase_realtime ADD TABLE public.batch_progress;

-- 8. postagem_eventos
CREATE TABLE IF NOT EXISTS public.postagem_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.postagem_templates(id) ON DELETE CASCADE,
  loja_id UUID REFERENCES public.lojas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  descricao TEXT,
  status_label TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  delay_horas INTEGER NOT NULL DEFAULT 0,
  enviar_email BOOLEAN NOT NULL DEFAULT true,
  enviar_nfe_pdf BOOLEAN NOT NULL DEFAULT false,
  assunto_email TEXT,
  corpo_email TEXT,
  is_final BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.postagem_eventos TO authenticated;
GRANT ALL ON public.postagem_eventos TO service_role;
ALTER TABLE public.postagem_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own loja postagem_eventos" ON public.postagem_eventos FOR ALL
  USING (
    loja_id IS NULL OR public.user_owns_loja(auth.uid(), loja_id)
    OR EXISTS (SELECT 1 FROM public.postagem_templates t WHERE t.id = template_id AND public.user_owns_loja(auth.uid(), t.loja_id))
  )
  WITH CHECK (
    loja_id IS NULL OR public.user_owns_loja(auth.uid(), loja_id)
    OR EXISTS (SELECT 1 FROM public.postagem_templates t WHERE t.id = template_id AND public.user_owns_loja(auth.uid(), t.loja_id))
  );

-- 9. RPCs: drop placeholders e recriar com assinatura original
DROP FUNCTION IF EXISTS public.get_my_debit_blocks();
DROP FUNCTION IF EXISTS public.get_my_debit_blocks(uuid);
DROP FUNCTION IF EXISTS public.get_admin_debit_diagnostics();

-- Garante extensão necessária? Não — usamos só built-ins.

CREATE OR REPLACE FUNCTION public.get_admin_debit_diagnostics()
RETURNS TABLE(
  loja_id uuid, loja_nome text, user_id uuid, user_email text, user_nome text,
  saldo numeric, motivo text, envios_travados bigint, pedidos_descartados bigint,
  ultima_atividade timestamptz, auto_envio boolean, filtro_metodo text, custo_estimado numeric
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_custo_email numeric; v_custo_nfe numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;
  SELECT COALESCE((SELECT value FROM system_config WHERE key='custo_email_rastreio'),1) INTO v_custo_email;
  SELECT COALESCE((SELECT value FROM system_config WHERE key='custo_nfe_email'),0.5) INTO v_custo_nfe;

  RETURN QUERY
  WITH stuck AS (
    SELECT e.loja_id, count(*)::bigint AS envios_travados, max(e.created_at) AS ultima_atividade
    FROM envios e
    WHERE e.deleted_at IS NULL AND e.ultimo_evento_ordem = 0 AND e.status='pendente'
      AND e.created_at > now()-interval '7 days' AND e.created_at < now()-interval '1 hour'
    GROUP BY e.loja_id
  ),
  descartes AS (
    SELECT p.loja_id, count(*)::bigint AS pedidos_descartados
    FROM pedidos p JOIN checkout_integrations ci ON ci.loja_id=p.loja_id
    WHERE p.envio_id IS NULL AND p.status IN ('paid','PAID','approved')
      AND p.created_at > now()-interval '3 days'
      AND ci.filtro_metodo IS NOT NULL AND ci.filtro_metodo<>'todos'
      AND ((ci.filtro_metodo='cartao' AND lower(coalesce(p.method,'')) LIKE '%pix%')
        OR (ci.filtro_metodo='pix' AND lower(coalesce(p.method,'')) NOT LIKE '%pix%'))
    GROUP BY p.loja_id
  ),
  base AS (
    SELECT l.id AS loja_id, l.nome AS loja_nome, l.user_id,
      pr.email AS user_email, pr.full_name AS user_nome,
      COALESCE(c.saldo,0)::numeric AS saldo,
      pc.auto_envio, ci.filtro_metodo,
      COALESCE(s.envios_travados,0) AS envios_travados,
      COALESCE(d.pedidos_descartados,0) AS pedidos_descartados,
      COALESCE(s.ultima_atividade, now()-interval '7 days') AS ultima_atividade,
      CASE
        WHEN COALESCE(pc.enviar_nfe_email,false) AND COALESCE(pc.enviar_emails,false) THEN v_custo_email+v_custo_nfe
        WHEN COALESCE(pc.enviar_emails,false) THEN v_custo_email
        WHEN COALESCE(pc.enviar_nfe_email,false) THEN v_custo_nfe
        ELSE 0
      END AS custo_estimado
    FROM lojas l
    JOIN profiles pr ON pr.id=l.user_id
    LEFT JOIN creditos c ON c.user_id=l.user_id
    LEFT JOIN postagem_config pc ON pc.loja_id=l.id
    LEFT JOIN checkout_integrations ci ON ci.loja_id=l.id
    LEFT JOIN stuck s ON s.loja_id=l.id
    LEFT JOIN descartes d ON d.loja_id=l.id
  )
  SELECT b.loja_id, b.loja_nome, b.user_id, b.user_email, b.user_nome, b.saldo,
    CASE
      WHEN b.envios_travados>0 AND b.auto_envio=false THEN 'auto_envio_off'
      WHEN b.envios_travados>0 AND b.saldo<b.custo_estimado AND b.custo_estimado>0 THEN 'saldo_insuficiente'
      WHEN b.pedidos_descartados>0 THEN 'filtro_metodo'
      WHEN b.envios_travados>0 THEN 'outro'
      ELSE NULL
    END AS motivo,
    b.envios_travados, b.pedidos_descartados, b.ultima_atividade,
    b.auto_envio, b.filtro_metodo, b.custo_estimado
  FROM base b
  WHERE b.envios_travados>0 OR b.pedidos_descartados>0
  ORDER BY (b.envios_travados+b.pedidos_descartados) DESC;
END $$;

CREATE OR REPLACE FUNCTION public.get_my_debit_blocks(p_loja_id uuid)
RETURNS TABLE(
  motivo text, envios_travados bigint, pedidos_descartados bigint,
  saldo numeric, custo_estimado numeric, auto_envio boolean, filtro_metodo text
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_custo_email numeric; v_custo_nfe numeric;
BEGIN
  IF NOT public.user_owns_loja(auth.uid(), p_loja_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  SELECT COALESCE((SELECT value FROM system_config WHERE key='custo_email_rastreio'),1) INTO v_custo_email;
  SELECT COALESCE((SELECT value FROM system_config WHERE key='custo_nfe_email'),0.5) INTO v_custo_nfe;

  RETURN QUERY
  WITH stuck AS (
    SELECT count(*)::bigint AS n FROM envios e
    WHERE e.loja_id=p_loja_id AND e.deleted_at IS NULL AND e.ultimo_evento_ordem=0
      AND e.status='pendente'
      AND e.created_at > now()-interval '7 days' AND e.created_at < now()-interval '1 hour'
  ),
  descartes AS (
    SELECT count(*)::bigint AS n FROM pedidos p
    JOIN checkout_integrations ci ON ci.loja_id=p.loja_id
    WHERE p.loja_id=p_loja_id AND p.envio_id IS NULL
      AND p.status IN ('paid','PAID','approved')
      AND p.created_at > now()-interval '3 days'
      AND ci.filtro_metodo IS NOT NULL AND ci.filtro_metodo<>'todos'
      AND ((ci.filtro_metodo='cartao' AND lower(coalesce(p.method,'')) LIKE '%pix%')
        OR (ci.filtro_metodo='pix' AND lower(coalesce(p.method,'')) NOT LIKE '%pix%'))
  ),
  cfg AS (
    SELECT pc.auto_envio, ci.filtro_metodo,
      CASE
        WHEN COALESCE(pc.enviar_nfe_email,false) AND COALESCE(pc.enviar_emails,false) THEN v_custo_email+v_custo_nfe
        WHEN COALESCE(pc.enviar_emails,false) THEN v_custo_email
        WHEN COALESCE(pc.enviar_nfe_email,false) THEN v_custo_nfe
        ELSE 0
      END AS custo_estimado,
      (SELECT saldo::numeric FROM creditos c JOIN lojas l ON l.user_id=c.user_id WHERE l.id=p_loja_id LIMIT 1) AS saldo
    FROM lojas l
    LEFT JOIN postagem_config pc ON pc.loja_id=l.id
    LEFT JOIN checkout_integrations ci ON ci.loja_id=l.id
    WHERE l.id=p_loja_id LIMIT 1
  )
  SELECT
    CASE
      WHEN (SELECT n FROM stuck)>0 AND cfg.auto_envio=false THEN 'auto_envio_off'
      WHEN (SELECT n FROM stuck)>0 AND COALESCE(cfg.saldo,0)<cfg.custo_estimado AND cfg.custo_estimado>0 THEN 'saldo_insuficiente'
      WHEN (SELECT n FROM descartes)>0 THEN 'filtro_metodo'
      WHEN (SELECT n FROM stuck)>0 THEN 'outro'
      ELSE NULL
    END AS motivo,
    (SELECT n FROM stuck) AS envios_travados,
    (SELECT n FROM descartes) AS pedidos_descartados,
    COALESCE(cfg.saldo,0) AS saldo,
    cfg.custo_estimado, cfg.auto_envio, cfg.filtro_metodo
  FROM cfg;
END $$;