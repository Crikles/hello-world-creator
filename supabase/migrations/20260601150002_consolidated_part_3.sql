-- Consolidated schema migration

-- ===== 20260428173446_c967f6ba-65b4-4dd1-9254-d1e80d840fe1.sql =====

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


-- ===== 20260429112743_a7d30dec-07ba-4023-bf02-963afefe9904.sql =====

CREATE OR REPLACE FUNCTION public.cleanup_old_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedidos int := 0;
  v_webhooks int := 0;
  v_wa_queue int := 0;
  v_cron int := 0;
  v_net int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem executar a limpeza';
  END IF;

  UPDATE public.pedidos SET raw_payload = NULL
  WHERE created_at < now() - interval '30 days' AND raw_payload IS NOT NULL;
  GET DIAGNOSTICS v_pedidos = ROW_COUNT;

  UPDATE public.webhook_logs SET payload = '{}'::jsonb
  WHERE created_at < now() - interval '30 days' AND processed = true AND payload <> '{}'::jsonb;
  GET DIAGNOSTICS v_webhooks = ROW_COUNT;

  DELETE FROM public.whatsapp_send_queue
  WHERE status IN ('cancelled','failed','sent') AND created_at < now() - interval '15 days';
  GET DIAGNOSTICS v_wa_queue = ROW_COUNT;

  BEGIN
    DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days';
    GET DIAGNOSTICS v_cron = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN v_cron := -1;
  END;

  BEGIN
    DELETE FROM net._http_response WHERE created < now() - interval '3 days';
    GET DIAGNOSTICS v_net = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN v_net := -1;
  END;

  RETURN jsonb_build_object(
    'pedidos_payload_limpos', v_pedidos,
    'webhooks_payload_limpos', v_webhooks,
    'whatsapp_queue_apagados', v_wa_queue,
    'cron_logs_apagados', v_cron,
    'pg_net_logs_apagados', v_net,
    'executado_em', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_old_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_old_data() TO authenticated;


-- ===== 20260429113358_288ad7e4-d30f-41a1-ba55-6e88540bb8e9.sql =====


-- Histórico de limpezas
CREATE TABLE IF NOT EXISTS public.cleanup_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_by uuid,
  action text NOT NULL,
  rows_affected integer NOT NULL DEFAULT 0,
  details jsonb,
  executed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cleanup_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage cleanup_history" ON public.cleanup_history;
CREATE POLICY "Admins manage cleanup_history" ON public.cleanup_history FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_cleanup_history_executed_at ON public.cleanup_history(executed_at DESC);

-- Estatísticas do banco
CREATE OR REPLACE FUNCTION public.get_cloud_usage_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_db_size bigint;
  v_tables jsonb;
  v_total_rows bigint := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem ver as estatísticas';
  END IF;

  v_db_size := pg_database_size(current_database());

  SELECT jsonb_agg(t ORDER BY (t->>'size_bytes')::bigint DESC)
  INTO v_tables
  FROM (
    SELECT jsonb_build_object(
      'table_name', relname,
      'size_bytes', pg_total_relation_size(('public.'||relname)::regclass),
      'size_pretty', pg_size_pretty(pg_total_relation_size(('public.'||relname)::regclass)),
      'row_estimate', n_live_tup
    ) AS t
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(('public.'||relname)::regclass) DESC
    LIMIT 20
  ) sub;

  RETURN jsonb_build_object(
    'db_size_bytes', v_db_size,
    'db_size_pretty', pg_size_pretty(v_db_size),
    'tables', COALESCE(v_tables, '[]'::jsonb),
    'generated_at', now()
  );
END;
$$;

-- Limpezas granulares
CREATE OR REPLACE FUNCTION public.cleanup_pedidos_payloads()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_n int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;
  UPDATE public.pedidos SET raw_payload = NULL
  WHERE created_at < now() - interval '30 days' AND raw_payload IS NOT NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  INSERT INTO public.cleanup_history(executed_by, action, rows_affected)
  VALUES (auth.uid(), 'pedidos_payloads', v_n);
  RETURN jsonb_build_object('rows_affected', v_n);
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_webhook_logs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_n int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;
  UPDATE public.webhook_logs SET payload = '{}'::jsonb
  WHERE created_at < now() - interval '30 days' AND processed = true AND payload <> '{}'::jsonb;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  INSERT INTO public.cleanup_history(executed_by, action, rows_affected)
  VALUES (auth.uid(), 'webhook_logs', v_n);
  RETURN jsonb_build_object('rows_affected', v_n);
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_whatsapp_queue()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_n int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;
  DELETE FROM public.whatsapp_send_queue
  WHERE status IN ('cancelled','failed','sent') AND created_at < now() - interval '15 days';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  INSERT INTO public.cleanup_history(executed_by, action, rows_affected)
  VALUES (auth.uid(), 'whatsapp_queue', v_n);
  RETURN jsonb_build_object('rows_affected', v_n);
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_internal_logs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_cron int := 0; v_net int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;
  BEGIN
    DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days';
    GET DIAGNOSTICS v_cron = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN v_cron := -1; END;
  BEGIN
    DELETE FROM net._http_response WHERE created < now() - interval '3 days';
    GET DIAGNOSTICS v_net = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN v_net := -1; END;
  INSERT INTO public.cleanup_history(executed_by, action, rows_affected, details)
  VALUES (auth.uid(), 'internal_logs', GREATEST(v_cron,0)+GREATEST(v_net,0),
          jsonb_build_object('cron', v_cron, 'pg_net', v_net));
  RETURN jsonb_build_object('cron_logs', v_cron, 'pg_net_logs', v_net);
END;
$$;



-- ===== 20260429151856_6b1c9923-64ac-474a-8fd4-eec1059104dd.sql =====

UPDATE public.envios
SET ultimo_evento_ordem = 1,
    status = 'em_transito',
    status_label = 'Postado',
    proximo_avanco_em = created_at + interval '24 hours',
    updated_at = now()
WHERE loja_id = '428f4bb4-5b53-4d34-a9a1-a139e7cceaaf'
  AND created_at >= '2026-04-29 00:00:00+00'
  AND deleted_at IS NULL
  AND ultimo_evento_ordem >= 2
  AND (updated_at - created_at) < interval '2 hours';


-- ===== 20260429151946_d865d3de-5fc9-4495-a203-f955c13e9524.sql =====

UPDATE public.envios
SET ultimo_evento_ordem = 1,
    status = 'em_transito',
    status_label = 'Postado',
    proximo_avanco_em = created_at + interval '24 hours',
    updated_at = now()
WHERE loja_id = '428f4bb4-5b53-4d34-a9a1-a139e7cceaaf'
  AND created_at >= '2026-04-29 00:00:00+00'
  AND deleted_at IS NULL
  AND status_label = 'Falha Entrega'
  AND updated_at >= '2026-04-29 14:50:00+00'
  AND updated_at <= '2026-04-29 14:55:00+00';


-- ===== 20260429152621_3ad7e8c3-10f7-4081-8f48-fc01d99afeb4.sql =====

-- ── A.1: Descongela envios da loja yaveh que estão com template diferente do ativo ──
UPDATE public.envios e
SET postagem_template_id = NULL
FROM public.postagem_config pc
WHERE e.loja_id = '428f4bb4-5b53-4d34-a9a1-a139e7cceaaf'
  AND pc.loja_id = e.loja_id
  AND e.deleted_at IS NULL
  AND e.status <> 'entregue'
  AND e.postagem_template_id IS NOT NULL
  AND e.postagem_template_id <> pc.template_ativo_id;

-- ── D: Limpeza global de templates duplicados ──
-- Para cada (loja_id, tipo) com >1 cópia não-system, mantém apenas a referenciada
-- pelo postagem_config.template_ativo_id (ou a mais recente como fallback).
WITH active_per_loja AS (
  SELECT loja_id, template_ativo_id FROM public.postagem_config
),
copies AS (
  SELECT
    pt.id, pt.loja_id, pt.tipo, pt.created_at,
    a.template_ativo_id AS active_id,
    ROW_NUMBER() OVER (
      PARTITION BY pt.loja_id, pt.tipo
      ORDER BY
        (pt.id = a.template_ativo_id) DESC NULLS LAST,
        pt.created_at DESC
    ) AS rn,
    COUNT(*) OVER (PARTITION BY pt.loja_id, pt.tipo) AS total
  FROM public.postagem_templates pt
  LEFT JOIN active_per_loja a ON a.loja_id = pt.loja_id
  WHERE pt.is_system = false
    AND pt.loja_id IS NOT NULL
),
to_delete AS (
  SELECT id FROM copies WHERE total > 1 AND rn > 1
),
-- Antes de deletar, nullificar referências em envios para esses templates
nullify AS (
  UPDATE public.envios
  SET postagem_template_id = NULL
  WHERE postagem_template_id IN (SELECT id FROM to_delete)
  RETURNING 1
),
-- Deletar eventos órfãos
del_evts AS (
  DELETE FROM public.postagem_eventos
  WHERE template_id IN (SELECT id FROM to_delete)
  RETURNING 1
)
DELETE FROM public.postagem_templates
WHERE id IN (SELECT id FROM to_delete);


-- ===== 20260429153940_0c9b65a9-c4eb-4cd5-b6ac-386f45849118.sql =====

CREATE OR REPLACE FUNCTION public.refund_user_credits(_user_id uuid, _quantidade numeric, _descricao text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_saldo NUMERIC;
BEGIN
  IF _quantidade <= 0 THEN
    RETURN FALSE;
  END IF;

  SELECT saldo INTO current_saldo
  FROM creditos WHERE user_id = _user_id FOR UPDATE;

  IF current_saldo IS NULL THEN
    INSERT INTO creditos (user_id, saldo) VALUES (_user_id, _quantidade);
  ELSE
    UPDATE creditos
    SET saldo = saldo + _quantidade, updated_at = now()
    WHERE user_id = _user_id;
  END IF;

  INSERT INTO creditos_transacoes (user_id, tipo, quantidade, descricao)
  VALUES (_user_id, 'estorno', _quantidade, _descricao);

  RETURN TRUE;
END;
$function$;


-- ===== 20260429154112_1ceca847-a5d4-4da6-86e4-f1256ff1bd3d.sql =====

UPDATE envios
SET ultimo_evento_ordem = 0,
    status = 'pendente'::shipment_status,
    status_label = NULL,
    proximo_avanco_em = NULL,
    updated_at = now()
WHERE id IN (
  SELECT e.id FROM envios e
  JOIN lojas l ON l.id = e.loja_id
  JOIN profiles p ON p.id = l.user_id
  WHERE p.email = 'backupativado@gmail.com'
    AND e.ultimo_evento_ordem = 1
    AND e.updated_at > '2026-04-29 15:25:30'
    AND e.deleted_at IS NULL
);


-- ===== 20260429175728_8ece34f4-d2a4-422b-aaff-0c67ba6d7bd7.sql =====

-- ============================================================
-- PARTE 0: Corrigir constraint que impedia tipo='estorno'
-- ============================================================
ALTER TABLE creditos_transacoes DROP CONSTRAINT IF EXISTS creditos_transacoes_tipo_check;
DO $c$ BEGIN ALTER TABLE creditos_transacoes ADD CONSTRAINT creditos_transacoes_tipo_check
  CHECK (tipo = ANY (ARRAY['adicao'::text, 'consumo'::text, 'estorno'::text, 'cashback'::text])); EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $c$;

-- ============================================================
-- PARTE 1: Estornar créditos cobrados em duplicidade
-- ============================================================
DO $$
DECLARE
  rec RECORD;
  v_total numeric;
BEGIN
  FOR rec IN
    WITH dups AS (
      SELECT envio_id, evento_id, destinatario, loja_id
      FROM postagem_email_log
      WHERE envio_id IS NOT NULL AND evento_id IS NOT NULL AND destinatario IS NOT NULL
      GROUP BY envio_id, evento_id, destinatario, loja_id
      HAVING COUNT(*) > 1
    ),
    per_user AS (
      SELECT lo.user_id, COUNT(DISTINCT d.envio_id) AS envios_duplicados
      FROM dups d
      JOIN lojas lo ON lo.id = d.loja_id
      GROUP BY lo.user_id
    )
    SELECT
      pu.user_id,
      pu.envios_duplicados,
      COALESCE((
        SELECT MAX(
          (CASE WHEN pc.enviar_nfe_email THEN COALESCE((p.custom_prices->>'custo_nfe_email')::numeric, 0.5) ELSE 0 END) +
          (CASE WHEN pc.enviar_emails THEN COALESCE((p.custom_prices->>'custo_email_rastreio')::numeric, 1.0) ELSE 0 END) +
          (CASE WHEN pc.ativar_taxacao THEN COALESCE((p.custom_prices->>'custo_taxacao')::numeric, 0) ELSE 0 END) +
          (CASE WHEN pc.ativar_falha_entrega THEN COALESCE((p.custom_prices->>'custo_falha_entrega')::numeric, 0) ELSE 0 END)
        )
        FROM lojas lo2
        JOIN postagem_config pc ON pc.loja_id = lo2.id
        LEFT JOIN profiles p ON p.id = lo2.user_id
        WHERE lo2.user_id = pu.user_id
      ), 1.5) AS custo_por_envio
    FROM per_user pu
  LOOP
    v_total := rec.envios_duplicados * rec.custo_por_envio;
    IF v_total > 0 THEN
      PERFORM public.refund_user_credits(
        rec.user_id,
        v_total,
        'Estorno automático: ' || rec.envios_duplicados || ' envio(s) cobrados em duplicidade (race condition email-trigger / advance-shipments)'
      );
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- PARTE 2: Deduplicar postagem_email_log (mantém o mais antigo)
-- ============================================================
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY envio_id, evento_id, destinatario, loja_id
      ORDER BY created_at ASC
    ) AS rn
  FROM postagem_email_log
  WHERE envio_id IS NOT NULL AND evento_id IS NOT NULL AND destinatario IS NOT NULL
)
DELETE FROM postagem_email_log
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ============================================================
-- PARTE 3: Índice único parcial para barrar duplicatas futuras
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS uniq_email_log_envio_evento_destinatario
  ON postagem_email_log (envio_id, evento_id, destinatario, loja_id)
  WHERE envio_id IS NOT NULL AND evento_id IS NOT NULL AND destinatario IS NOT NULL;


-- ===== 20260430141324_ab226379-35e8-4c07-8e3d-b98572137fe6.sql =====


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



-- ===== 20260502001237_31a4fe0f-b28f-4747-99de-1a08210a61cd.sql =====

-- Backfill: remove envios "saiu_para_entrega" da fila do cron.
-- O próximo evento natural seria "Entregue" (manual), portanto não há nada a avançar.
UPDATE public.envios
SET proximo_avanco_em = NULL
WHERE deleted_at IS NULL
  AND status = 'saiu_para_entrega'
  AND proximo_avanco_em IS NOT NULL;


-- ===== 20260508023132_12634c23-9ed6-4258-9c74-40846b7824b6.sql =====


CREATE OR REPLACE FUNCTION public.get_admin_user_activity()
RETURNS TABLE(
  user_id uuid,
  ultimo_deposito timestamptz,
  total_envios bigint,
  envios_30d bigint,
  ultimo_envio timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS user_id,
    (SELECT MAX(pp.paid_at) FROM pix_payments pp WHERE pp.user_id = p.id AND pp.status = 'PAID') AS ultimo_deposito,
    (SELECT COUNT(*) FROM lojas l JOIN envios e ON e.loja_id = l.id WHERE l.user_id = p.id AND e.deleted_at IS NULL) AS total_envios,
    (SELECT COUNT(*) FROM lojas l JOIN envios e ON e.loja_id = l.id WHERE l.user_id = p.id AND e.deleted_at IS NULL AND e.created_at > now() - interval '30 days') AS envios_30d,
    (SELECT MAX(e.created_at) FROM lojas l JOIN envios e ON e.loja_id = l.id WHERE l.user_id = p.id AND e.deleted_at IS NULL) AS ultimo_envio
  FROM profiles p
  WHERE has_role(auth.uid(), 'admin'::app_role);
$$;



-- ===== 20260508150947_22f44fed-1640-4d19-8119-553e75f28298.sql =====


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



-- ===== 20260515154306_4c7a6245-6a6b-4044-a519-34237f67e0bf.sql =====

CREATE OR REPLACE FUNCTION public.sync_envios_on_template_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.template_ativo_id IS DISTINCT FROM OLD.template_ativo_id
     AND NEW.template_ativo_id IS NOT NULL THEN
    UPDATE public.envios
    SET postagem_template_id = NEW.template_ativo_id
    WHERE loja_id = NEW.loja_id
      AND deleted_at IS NULL
      AND status <> 'entregue'
      AND (
        postagem_template_id IS DISTINCT FROM NEW.template_ativo_id
      );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_envios_on_template_change ON public.postagem_config;

DROP TRIGGER IF EXISTS trg_sync_envios_on_template_change ON public.postagem_config;
CREATE TRIGGER trg_sync_envios_on_template_change
AFTER UPDATE OF template_ativo_id ON public.postagem_config
FOR EACH ROW
EXECUTE FUNCTION public.sync_envios_on_template_change();


-- ===== 20260516204823_c6e80509-fd94-44c0-9fe5-a5a3784883b7.sql =====




-- ===== 20260520150200_4a9a559d-2f36-4792-bf0a-4a9d71307210.sql =====


-- Índices para acelerar crons (advance-shipments, backfill)
CREATE INDEX IF NOT EXISTS idx_envios_loja_status_proximo
  ON public.envios (loja_id, status, proximo_avanco_em)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_envios_proximo_avanco
  ON public.envios (proximo_avanco_em)
  WHERE deleted_at IS NULL AND status <> 'entregue';

CREATE INDEX IF NOT EXISTS idx_envios_created_ordem
  ON public.envios (created_at DESC)
  WHERE deleted_at IS NULL AND ultimo_evento_ordem > 0;

CREATE INDEX IF NOT EXISTS idx_postagem_email_log_envio
  ON public.postagem_email_log (envio_id, status);

CREATE INDEX IF NOT EXISTS idx_live_view_pings_created
  ON public.live_view_pings (created_at);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_created
  ON public.webhook_logs (created_at);

CREATE INDEX IF NOT EXISTS idx_pedidos_created
  ON public.pedidos (created_at);

-- Ampliar função de limpeza
CREATE OR REPLACE FUNCTION public.cleanup_old_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pedidos int := 0;
  v_webhooks int := 0;
  v_wa_queue int := 0;
  v_pings int := 0;
  v_signup int := 0;
  v_batch int := 0;
  v_retry int := 0;
  v_conf_log int := 0;
  v_cron int := 0;
  v_net int := 0;
  v_caller uuid;
BEGIN
  v_caller := auth.uid();
  -- Permite execução pelo service_role (cron) ou por admin autenticado
  IF v_caller IS NOT NULL AND NOT public.has_role(v_caller, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem executar a limpeza';
  END IF;

  UPDATE public.pedidos SET raw_payload = NULL
  WHERE created_at < now() - interval '30 days' AND raw_payload IS NOT NULL;
  GET DIAGNOSTICS v_pedidos = ROW_COUNT;

  UPDATE public.webhook_logs SET payload = '{}'::jsonb
  WHERE created_at < now() - interval '30 days' AND processed = true AND payload <> '{}'::jsonb;
  GET DIAGNOSTICS v_webhooks = ROW_COUNT;

  DELETE FROM public.whatsapp_send_queue
  WHERE status IN ('cancelled','failed','sent') AND created_at < now() - interval '15 days';
  GET DIAGNOSTICS v_wa_queue = ROW_COUNT;

  DELETE FROM public.live_view_pings
  WHERE created_at < now() - interval '7 days';
  GET DIAGNOSTICS v_pings = ROW_COUNT;

  DELETE FROM public.signup_verifications
  WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS v_signup = ROW_COUNT;

  DELETE FROM public.batch_progress
  WHERE updated_at < now() - interval '7 days';
  GET DIAGNOSTICS v_batch = ROW_COUNT;

  DELETE FROM public.retry_execucoes
  WHERE started_at < now() - interval '30 days';
  GET DIAGNOSTICS v_retry = ROW_COUNT;

  DELETE FROM public.confirmacao_pagamento_log
  WHERE created_at < now() - interval '90 days' AND status IN ('sent','delivered');
  GET DIAGNOSTICS v_conf_log = ROW_COUNT;

  BEGIN
    DELETE FROM cron.job_run_details WHERE end_time < now() - interval '3 days';
    GET DIAGNOSTICS v_cron = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN v_cron := -1;
  END;

  BEGIN
    DELETE FROM net._http_response WHERE created < now() - interval '2 days';
    GET DIAGNOSTICS v_net = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN v_net := -1;
  END;

  INSERT INTO public.cleanup_history(executed_by, action, rows_affected, details)
  VALUES (
    v_caller, 'cleanup_old_data_auto',
    v_pedidos + v_webhooks + v_wa_queue + v_pings + v_signup + v_batch + v_retry + v_conf_log + GREATEST(v_cron,0) + GREATEST(v_net,0),
    jsonb_build_object(
      'pedidos_payload', v_pedidos,
      'webhooks_payload', v_webhooks,
      'whatsapp_queue', v_wa_queue,
      'live_view_pings', v_pings,
      'signup_verifications', v_signup,
      'batch_progress', v_batch,
      'retry_execucoes', v_retry,
      'confirmacao_log', v_conf_log,
      'cron_logs', v_cron,
      'pg_net_logs', v_net
    )
  );

  RETURN jsonb_build_object(
    'pedidos_payload_limpos', v_pedidos,
    'webhooks_payload_limpos', v_webhooks,
    'whatsapp_queue_apagados', v_wa_queue,
    'live_view_pings_apagados', v_pings,
    'signup_verifications_apagados', v_signup,
    'batch_progress_apagados', v_batch,
    'retry_execucoes_apagados', v_retry,
    'confirmacao_log_apagados', v_conf_log,
    'cron_logs_apagados', v_cron,
    'pg_net_logs_apagados', v_net,
    'executado_em', now()
  );
END;
$function$;



-- ===== 20260520151534_32330b22-89a7-4b66-84b7-abffebf1e03c.sql =====

CREATE OR REPLACE FUNCTION public.get_cloud_usage_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_db_size bigint;
  v_tables jsonb;
  v_total_dead bigint := 0;
  v_total_live bigint := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem ver as estatísticas';
  END IF;

  v_db_size := pg_database_size(current_database());

  SELECT 
    jsonb_agg(t ORDER BY (t->>'size_bytes')::bigint DESC),
    COALESCE(SUM((t->>'dead_tuples')::bigint), 0),
    COALESCE(SUM((t->>'live_tuples')::bigint), 0)
  INTO v_tables, v_total_dead, v_total_live
  FROM (
    SELECT jsonb_build_object(
      'table_name', relname,
      'size_bytes', pg_total_relation_size(('public.'||relname)::regclass),
      'size_pretty', pg_size_pretty(pg_total_relation_size(('public.'||relname)::regclass)),
      'row_estimate', n_live_tup,
      'dead_tuples', n_dead_tup,
      'live_tuples', n_live_tup,
      'bloat_ratio', CASE WHEN (n_live_tup + n_dead_tup) > 0 
        THEN ROUND((n_dead_tup::numeric / (n_live_tup + n_dead_tup)) * 100, 1)
        ELSE 0 END
    ) AS t
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(('public.'||relname)::regclass) DESC
    LIMIT 20
  ) sub;

  RETURN jsonb_build_object(
    'db_size_bytes', v_db_size,
    'db_size_pretty', pg_size_pretty(v_db_size),
    'tables', COALESCE(v_tables, '[]'::jsonb),
    'total_dead_tuples', v_total_dead,
    'total_live_tuples', v_total_live,
    'bloat_estimate_pct', CASE WHEN (v_total_live + v_total_dead) > 0
      THEN ROUND((v_total_dead::numeric / (v_total_live + v_total_dead)) * 100, 1)
      ELSE 0 END,
    'generated_at', now()
  );
END;
$function$;


-- ===== 20260520152346_6f7506a1-f020-43c3-afcc-372e887a34ec.sql =====

CREATE OR REPLACE FUNCTION public.get_cloud_usage_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_db_size bigint;
  v_tables jsonb;
  v_total_dead bigint := 0;
  v_total_live bigint := 0;
  v_pedidos_candidates bigint := 0;
  v_webhook_candidates bigint := 0;
  v_whatsapp_candidates bigint := 0;
  v_internal_logs_candidates bigint := 0;
  v_cron_candidates bigint := 0;
  v_net_candidates bigint := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem ver as estatísticas';
  END IF;

  v_db_size := pg_database_size(current_database());

  SELECT 
    jsonb_agg(t ORDER BY (t->>'size_bytes')::bigint DESC),
    COALESCE(SUM((t->>'dead_tuples')::bigint), 0),
    COALESCE(SUM((t->>'live_tuples')::bigint), 0)
  INTO v_tables, v_total_dead, v_total_live
  FROM (
    SELECT jsonb_build_object(
      'table_name', relname,
      'size_bytes', pg_total_relation_size(('public.'||relname)::regclass),
      'size_pretty', pg_size_pretty(pg_total_relation_size(('public.'||relname)::regclass)),
      'row_estimate', n_live_tup,
      'dead_tuples', n_dead_tup,
      'live_tuples', n_live_tup,
      'bloat_ratio', CASE WHEN (n_live_tup + n_dead_tup) > 0 
        THEN ROUND((n_dead_tup::numeric / (n_live_tup + n_dead_tup)) * 100, 1)
        ELSE 0 END
    ) AS t
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(('public.'||relname)::regclass) DESC
    LIMIT 20
  ) sub;

  SELECT COUNT(*) INTO v_pedidos_candidates
  FROM public.pedidos
  WHERE created_at < now() - interval '30 days'
    AND raw_payload IS NOT NULL;

  SELECT COUNT(*) INTO v_webhook_candidates
  FROM public.webhook_logs
  WHERE created_at < now() - interval '30 days'
    AND processed = true
    AND payload <> '{}'::jsonb;

  SELECT COUNT(*) INTO v_whatsapp_candidates
  FROM public.whatsapp_send_queue
  WHERE status IN ('cancelled','failed','sent')
    AND created_at < now() - interval '15 days';

  BEGIN
    SELECT COUNT(*) INTO v_cron_candidates
    FROM cron.job_run_details
    WHERE end_time < now() - interval '7 days';
  EXCEPTION WHEN OTHERS THEN
    v_cron_candidates := 0;
  END;

  BEGIN
    SELECT COUNT(*) INTO v_net_candidates
    FROM net._http_response
    WHERE created < now() - interval '3 days';
  EXCEPTION WHEN OTHERS THEN
    v_net_candidates := 0;
  END;

  v_internal_logs_candidates := COALESCE(v_cron_candidates, 0) + COALESCE(v_net_candidates, 0);

  RETURN jsonb_build_object(
    'db_size_bytes', v_db_size,
    'db_size_pretty', pg_size_pretty(v_db_size),
    'tables', COALESCE(v_tables, '[]'::jsonb),
    'cleanup_candidates', jsonb_build_object(
      'pedidos_payloads', v_pedidos_candidates,
      'webhook_logs', v_webhook_candidates,
      'whatsapp_queue', v_whatsapp_candidates,
      'internal_logs', v_internal_logs_candidates
    ),
    'total_dead_tuples', v_total_dead,
    'total_live_tuples', v_total_live,
    'bloat_estimate_pct', CASE WHEN (v_total_live + v_total_dead) > 0
      THEN ROUND((v_total_dead::numeric / (v_total_live + v_total_dead)) * 100, 1)
      ELSE 0 END,
    'generated_at', now()
  );
END;
$function$;


-- ===== 20260601132736_e9b38402-58b2-4dc7-aab6-bdcb5456734c.sql =====


-- ===== 20260221232925 =====
DO $w$ BEGIN CREATE TYPE public.shipment_status AS ENUM ('pendente', 'em_transito', 'saiu_para_entrega', 'entregue'); EXCEPTION WHEN duplicate_object THEN NULL; END $w$;

CREATE TABLE IF NOT EXISTS public.empresas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  razao_social TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  inscricao_estadual TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  telefone TEXT,
  email TEXT,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.envios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES public.empresas(id),
  cliente_nome TEXT NOT NULL,
  cliente_email TEXT NOT NULL,
  cliente_cpf TEXT,
  cliente_endereco TEXT,
  cliente_cidade TEXT,
  cliente_estado TEXT,
  cliente_cep TEXT,
  produto TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  codigo_rastreio TEXT,
  status public.shipment_status NOT NULL DEFAULT 'pendente',
  nfe_numero TEXT,
  nfe_serie TEXT,
  nfe_chave_acesso TEXT,
  transportadora TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.envios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to empresas" ON public.empresas;
CREATE POLICY "Allow all access to empresas" ON public.empresas FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all access to envios" ON public.envios;
CREATE POLICY "Allow all access to envios" ON public.envios FOR ALL USING (true) WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Public access to logos" ON storage.objects;
CREATE POLICY "Public access to logos" ON storage.objects FOR SELECT USING (bucket_id = 'logos');
DROP POLICY IF EXISTS "Allow upload to logos" ON storage.objects;
CREATE POLICY "Allow upload to logos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'logos');
DROP POLICY IF EXISTS "Allow update logos" ON storage.objects;
CREATE POLICY "Allow update logos" ON storage.objects FOR UPDATE USING (bucket_id = 'logos');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_empresas_updated_at ON public.empresas;
CREATE TRIGGER update_empresas_updated_at BEFORE UPDATE ON public.empresas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_envios_updated_at ON public.envios;
CREATE TRIGGER update_envios_updated_at BEFORE UPDATE ON public.envios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== 20260221235625 =====
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS nome_fantasia text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS numero text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS bairro text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS complemento text;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS cliente_telefone text;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS cliente_numero text;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS cliente_bairro text;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS cliente_complemento text;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS quantidade integer NOT NULL DEFAULT 1;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS cfop text;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS ncm_sh text;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS cst text;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS unidade text NOT NULL DEFAULT 'UN';

-- ===== 20260224114911 =====
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checkout_provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT,
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.pedidos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checkout_provider TEXT NOT NULL,
  transaction_token TEXT NOT NULL,
  status TEXT NOT NULL,
  method TEXT,
  total_price INTEGER NOT NULL DEFAULT 0,
  customer_name TEXT,
  customer_document TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  address_street TEXT,
  address_number TEXT,
  address_district TEXT,
  address_zip_code TEXT,
  address_city TEXT,
  address_state TEXT,
  address_country TEXT,
  address_complement TEXT,
  products JSONB,
  raw_payload JSONB,
  envio_id UUID REFERENCES public.envios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_provider_token ON public.pedidos (checkout_provider, transaction_token);
DROP TRIGGER IF EXISTS update_pedidos_updated_at ON public.pedidos;
CREATE TRIGGER update_pedidos_updated_at BEFORE UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== 20260224115530 =====
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE IF NOT EXISTS public.lojas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lojas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own lojas" ON public.lojas;
CREATE POLICY "Users can view own lojas" ON public.lojas FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own lojas" ON public.lojas;
CREATE POLICY "Users can insert own lojas" ON public.lojas FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own lojas" ON public.lojas;
CREATE POLICY "Users can update own lojas" ON public.lojas FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own lojas" ON public.lojas;
CREATE POLICY "Users can delete own lojas" ON public.lojas FOR DELETE USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_lojas_updated_at ON public.lojas;
CREATE TRIGGER update_lojas_updated_at BEFORE UPDATE ON public.lojas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.check_max_lojas()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.lojas WHERE user_id = NEW.user_id) >= 5 THEN
    RAISE EXCEPTION 'Limite de 5 lojas por usuário atingido';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enforce_max_lojas ON public.lojas;
CREATE TRIGGER enforce_max_lojas BEFORE INSERT ON public.lojas FOR EACH ROW EXECUTE FUNCTION public.check_max_lojas();

CREATE OR REPLACE FUNCTION public.user_owns_loja(_user_id UUID, _loja_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.lojas WHERE id = _loja_id AND user_id = _user_id);
$$;

ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS loja_id UUID REFERENCES public.lojas(id) ON DELETE CASCADE;
DROP POLICY IF EXISTS "Allow all access to empresas" ON public.empresas;
DROP POLICY IF EXISTS "Users access own loja empresas" ON public.empresas;
CREATE POLICY "Users access own loja empresas" ON public.empresas FOR ALL
  USING (public.user_owns_loja(auth.uid(), loja_id)) WITH CHECK (public.user_owns_loja(auth.uid(), loja_id));

ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS loja_id UUID REFERENCES public.lojas(id) ON DELETE CASCADE;
DROP POLICY IF EXISTS "Allow all access to envios" ON public.envios;
DROP POLICY IF EXISTS "Users access own loja envios" ON public.envios;
CREATE POLICY "Users access own loja envios" ON public.envios FOR ALL
  USING (public.user_owns_loja(auth.uid(), loja_id)) WITH CHECK (public.user_owns_loja(auth.uid(), loja_id));

ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS loja_id UUID REFERENCES public.lojas(id) ON DELETE CASCADE;
DROP POLICY IF EXISTS "Users access own loja pedidos" ON public.pedidos;
CREATE POLICY "Users access own loja pedidos" ON public.pedidos FOR ALL
  USING (public.user_owns_loja(auth.uid(), loja_id)) WITH CHECK (public.user_owns_loja(auth.uid(), loja_id));

ALTER TABLE public.webhook_logs ADD COLUMN IF NOT EXISTS loja_id UUID REFERENCES public.lojas(id) ON DELETE CASCADE;
DROP POLICY IF EXISTS "Users access own loja webhook_logs" ON public.webhook_logs;
CREATE POLICY "Users access own loja webhook_logs" ON public.webhook_logs FOR ALL
  USING (public.user_owns_loja(auth.uid(), loja_id)) WITH CHECK (public.user_owns_loja(auth.uid(), loja_id));

CREATE INDEX IF NOT EXISTS idx_lojas_user_id ON public.lojas(user_id);
CREATE INDEX IF NOT EXISTS idx_lojas_slug ON public.lojas(slug);
CREATE INDEX IF NOT EXISTS idx_empresas_loja_id ON public.empresas(loja_id);
CREATE INDEX IF NOT EXISTS idx_envios_loja_id ON public.envios(loja_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_loja_id ON public.pedidos(loja_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_loja_id ON public.webhook_logs(loja_id);

-- ===== 20260224120059 =====
DO $w$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin', 'user'); EXCEPTION WHEN duplicate_object THEN NULL; END $w$;
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
-- skipped seed: admin user does not exist in new DB

CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_role AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.assign_default_role();

-- ===== 20260224122306 =====
CREATE TABLE IF NOT EXISTS public.creditos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  saldo INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.creditos ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.creditos_transacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('adicao', 'consumo')),
  quantidade INTEGER NOT NULL,
  descricao TEXT,
  admin_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.creditos_transacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own credits" ON public.creditos;
CREATE POLICY "Users view own credits" ON public.creditos FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins full access credits" ON public.creditos;
CREATE POLICY "Admins full access credits" ON public.creditos FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Users view own transactions" ON public.creditos_transacoes;
CREATE POLICY "Users view own transactions" ON public.creditos_transacoes FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins full access transactions" ON public.creditos_transacoes;
CREATE POLICY "Admins full access transactions" ON public.creditos_transacoes FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.create_user_credits()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.creditos (user_id, saldo) VALUES (NEW.id, 0);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created_credits ON auth.users;
CREATE TRIGGER on_auth_user_created_credits AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_user_credits();

INSERT INTO public.creditos (user_id, saldo)
SELECT id, 0 FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.creditos);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can view all lojas" ON public.lojas;
CREATE POLICY "Admins can view all lojas" ON public.lojas FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can view all envios" ON public.envios;
CREATE POLICY "Admins can view all envios" ON public.envios FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- ===== 20260224131245 =====
-- ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'coletado';
-- ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'centro_local';
-- ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'taxacao';
-- ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'pagamento_confirmado';
