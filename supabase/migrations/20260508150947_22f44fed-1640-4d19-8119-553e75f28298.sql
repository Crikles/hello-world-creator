
-- RPC for admin: diagnose stores with stuck shipments grouped by reason
CREATE OR REPLACE FUNCTION public.get_admin_debit_diagnostics()
RETURNS TABLE(
  loja_id uuid,
  loja_nome text,
  user_id uuid,
  user_email text,
  user_nome text,
  saldo numeric,
  motivo text,
  envios_travados bigint,
  pedidos_descartados bigint,
  ultima_atividade timestamptz,
  auto_envio boolean,
  filtro_metodo text,
  custo_estimado numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_custo_email numeric;
  v_custo_nfe numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;

  SELECT COALESCE((SELECT value FROM system_config WHERE key = 'custo_email_rastreio'), 1) INTO v_custo_email;
  SELECT COALESCE((SELECT value FROM system_config WHERE key = 'custo_nfe_email'), 0.5) INTO v_custo_nfe;

  RETURN QUERY
  WITH stuck AS (
    SELECT e.loja_id,
           count(*) AS envios_travados,
           max(e.created_at) AS ultima_atividade
    FROM envios e
    WHERE e.deleted_at IS NULL
      AND e.ultimo_evento_ordem = 0
      AND e.status = 'pendente'
      AND e.created_at > now() - interval '7 days'
      AND e.created_at < now() - interval '1 hour'
    GROUP BY e.loja_id
  ),
  descartes AS (
    -- pedidos pagos cuja regra de filtro_metodo bloqueou criação de envio
    SELECT p.loja_id,
           count(*) AS pedidos_descartados
    FROM pedidos p
    JOIN checkout_integrations ci ON ci.loja_id = p.loja_id
    WHERE p.envio_id IS NULL
      AND p.status IN ('paid', 'PAID', 'approved')
      AND p.created_at > now() - interval '3 days'
      AND ci.filtro_metodo IS NOT NULL
      AND ci.filtro_metodo <> 'todos'
      AND (
        (ci.filtro_metodo = 'cartao' AND lower(coalesce(p.method, '')) LIKE '%pix%') OR
        (ci.filtro_metodo = 'pix' AND lower(coalesce(p.method, '')) NOT LIKE '%pix%')
      )
    GROUP BY p.loja_id
  ),
  base AS (
    SELECT l.id AS loja_id,
           l.nome AS loja_nome,
           l.user_id,
           pr.email AS user_email,
           pr.full_name AS user_nome,
           COALESCE(c.saldo, 0) AS saldo,
           pc.auto_envio,
           ci.filtro_metodo,
           COALESCE(s.envios_travados, 0) AS envios_travados,
           COALESCE(d.pedidos_descartados, 0) AS pedidos_descartados,
           GREATEST(s.ultima_atividade, now() - interval '7 days') AS ultima_atividade,
           CASE
             WHEN COALESCE(pc.enviar_nfe_email, false) AND COALESCE(pc.enviar_emails, false) THEN v_custo_email + v_custo_nfe
             WHEN COALESCE(pc.enviar_emails, false) THEN v_custo_email
             WHEN COALESCE(pc.enviar_nfe_email, false) THEN v_custo_nfe
             ELSE 0
           END AS custo_estimado
    FROM lojas l
    JOIN profiles pr ON pr.id = l.user_id
    LEFT JOIN creditos c ON c.user_id = l.user_id
    LEFT JOIN postagem_config pc ON pc.loja_id = l.id
    LEFT JOIN checkout_integrations ci ON ci.loja_id = l.id
    LEFT JOIN stuck s ON s.loja_id = l.id
    LEFT JOIN descartes d ON d.loja_id = l.id
  )
  SELECT
    b.loja_id, b.loja_nome, b.user_id, b.user_email, b.user_nome, b.saldo,
    CASE
      WHEN b.envios_travados > 0 AND b.auto_envio = false THEN 'auto_envio_off'
      WHEN b.envios_travados > 0 AND b.saldo < b.custo_estimado AND b.custo_estimado > 0 THEN 'saldo_insuficiente'
      WHEN b.pedidos_descartados > 0 THEN 'filtro_metodo'
      WHEN b.envios_travados > 0 THEN 'outro'
      ELSE NULL
    END AS motivo,
    b.envios_travados,
    b.pedidos_descartados,
    b.ultima_atividade,
    b.auto_envio,
    b.filtro_metodo,
    b.custo_estimado
  FROM base b
  WHERE b.envios_travados > 0 OR b.pedidos_descartados > 0
  ORDER BY (b.envios_travados + b.pedidos_descartados) DESC;
END;
$$;

-- RPC for store owner: get my own debit blocks
CREATE OR REPLACE FUNCTION public.get_my_debit_blocks(p_loja_id uuid)
RETURNS TABLE(
  motivo text,
  envios_travados bigint,
  pedidos_descartados bigint,
  saldo numeric,
  custo_estimado numeric,
  auto_envio boolean,
  filtro_metodo text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_custo_email numeric;
  v_custo_nfe numeric;
BEGIN
  IF NOT public.user_owns_loja(auth.uid(), p_loja_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT COALESCE((SELECT value FROM system_config WHERE key = 'custo_email_rastreio'), 1) INTO v_custo_email;
  SELECT COALESCE((SELECT value FROM system_config WHERE key = 'custo_nfe_email'), 0.5) INTO v_custo_nfe;

  RETURN QUERY
  WITH stuck AS (
    SELECT count(*) AS n
    FROM envios e
    WHERE e.loja_id = p_loja_id
      AND e.deleted_at IS NULL
      AND e.ultimo_evento_ordem = 0
      AND e.status = 'pendente'
      AND e.created_at > now() - interval '7 days'
      AND e.created_at < now() - interval '1 hour'
  ),
  descartes AS (
    SELECT count(*) AS n
    FROM pedidos p
    JOIN checkout_integrations ci ON ci.loja_id = p.loja_id
    WHERE p.loja_id = p_loja_id
      AND p.envio_id IS NULL
      AND p.status IN ('paid', 'PAID', 'approved')
      AND p.created_at > now() - interval '3 days'
      AND ci.filtro_metodo IS NOT NULL
      AND ci.filtro_metodo <> 'todos'
      AND (
        (ci.filtro_metodo = 'cartao' AND lower(coalesce(p.method, '')) LIKE '%pix%') OR
        (ci.filtro_metodo = 'pix' AND lower(coalesce(p.method, '')) NOT LIKE '%pix%')
      )
  ),
  cfg AS (
    SELECT
      pc.auto_envio,
      ci.filtro_metodo,
      CASE
        WHEN COALESCE(pc.enviar_nfe_email, false) AND COALESCE(pc.enviar_emails, false) THEN v_custo_email + v_custo_nfe
        WHEN COALESCE(pc.enviar_emails, false) THEN v_custo_email
        WHEN COALESCE(pc.enviar_nfe_email, false) THEN v_custo_nfe
        ELSE 0
      END AS custo_estimado,
      (SELECT saldo FROM creditos c JOIN lojas l ON l.user_id = c.user_id WHERE l.id = p_loja_id LIMIT 1) AS saldo
    FROM lojas l
    LEFT JOIN postagem_config pc ON pc.loja_id = l.id
    LEFT JOIN checkout_integrations ci ON ci.loja_id = l.id
    WHERE l.id = p_loja_id
    LIMIT 1
  )
  SELECT
    CASE
      WHEN (SELECT n FROM stuck) > 0 AND cfg.auto_envio = false THEN 'auto_envio_off'
      WHEN (SELECT n FROM stuck) > 0 AND COALESCE(cfg.saldo, 0) < cfg.custo_estimado AND cfg.custo_estimado > 0 THEN 'saldo_insuficiente'
      WHEN (SELECT n FROM descartes) > 0 THEN 'filtro_metodo'
      WHEN (SELECT n FROM stuck) > 0 THEN 'outro'
      ELSE NULL
    END AS motivo,
    (SELECT n FROM stuck) AS envios_travados,
    (SELECT n FROM descartes) AS pedidos_descartados,
    COALESCE(cfg.saldo, 0) AS saldo,
    cfg.custo_estimado,
    cfg.auto_envio,
    cfg.filtro_metodo
  FROM cfg;
END;
$$;
