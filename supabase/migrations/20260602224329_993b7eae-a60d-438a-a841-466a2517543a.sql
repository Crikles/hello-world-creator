
-- 1. push_notification_log: admin-only
DROP POLICY IF EXISTS "Authenticated full push_log" ON public.push_notification_log;
CREATE POLICY "Admins view push_log" ON public.push_notification_log
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service manage push_log" ON public.push_notification_log
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 2. push_notification_settings: read=auth, write=admin
DROP POLICY IF EXISTS "Authenticated full push_settings" ON public.push_notification_settings;
CREATE POLICY "Authenticated read push_settings" ON public.push_notification_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins write push_settings" ON public.push_notification_settings
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update push_settings" ON public.push_notification_settings
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete push_settings" ON public.push_notification_settings
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service manage push_settings" ON public.push_notification_settings
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 3. push_subscriptions: client never writes/reads; only admins/service
DROP POLICY IF EXISTS "Public insert push_subs" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Public select push_subs" ON public.push_subscriptions;
CREATE POLICY "Admins view push_subs" ON public.push_subscriptions
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service manage push_subs" ON public.push_subscriptions
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 6/7. Logos bucket: restrict write to owner folder; SELECT remains public
DROP POLICY IF EXISTS "Allow upload to logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow update logos" ON storage.objects;
DROP POLICY IF EXISTS "Public access to logos" ON storage.objects;

CREATE POLICY "Logos public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'logos');

CREATE POLICY "Logos owner insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Logos owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Logos owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 8/9. SECURITY DEFINER hardening
-- Revogar de anon em todas (e de authenticated nas que são trigger-only ou service-only)
REVOKE EXECUTE ON FUNCTION public.assign_default_role() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.check_max_lojas() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.create_user_credits() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.generate_tracking_code() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.try_create_envio_dedupe(uuid, text, numeric, jsonb) FROM anon, authenticated, public;

-- Funções chamadas via supabase.rpc no front (autenticadas) — remover anon, manter authenticated
REVOKE EXECUTE ON FUNCTION public.get_admin_debit_diagnostics() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_my_debit_blocks(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.debit_user_credits(uuid, numeric, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_loja_faturamento(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_loja_chart_data(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_envios_stats(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_admin_user_activity() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_confirmacao_grouped(uuid, text, text, text, integer, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_confirmacao_placar(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_envios_paginated(uuid, text, text, text, text, timestamptz, timestamptz, integer, integer) FROM anon, public;

-- has_role e user_owns_loja são usados em policies — manter anon (SQL roda como invoker em RLS)
-- Apenas garantir grants:
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_owns_loja(uuid, uuid) TO anon, authenticated;
