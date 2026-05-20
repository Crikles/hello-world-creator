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