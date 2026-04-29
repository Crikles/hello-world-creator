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