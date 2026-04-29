
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

CREATE POLICY "Admins manage cleanup_history"
ON public.cleanup_history FOR ALL
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
