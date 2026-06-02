GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_subscriptions TO authenticated;
GRANT ALL ON public.whatsapp_subscriptions TO service_role;

-- Mesma situação preventiva para as outras tabelas whatsapp se faltar
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_send_queue TO authenticated;
GRANT ALL ON public.whatsapp_send_queue TO service_role;