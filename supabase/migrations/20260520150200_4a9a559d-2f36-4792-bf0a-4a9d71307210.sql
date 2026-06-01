
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
