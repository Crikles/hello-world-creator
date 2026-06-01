
CREATE TABLE IF NOT EXISTS public.signup_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  code TEXT,
  verified_at TIMESTAMPTZ,
  approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.signup_verifications TO authenticated;
GRANT ALL ON public.signup_verifications TO service_role;
ALTER TABLE public.signup_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage signup_verifications" ON public.signup_verifications
  FOR ALL USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.whatsapp_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  loja_id UUID,
  price_paid NUMERIC DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_subscriptions TO authenticated;
GRANT ALL ON public.whatsapp_subscriptions TO service_role;
ALTER TABLE public.whatsapp_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own whatsapp_subscriptions" ON public.whatsapp_subscriptions
  FOR ALL USING ((auth.uid() = user_id) OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK ((auth.uid() = user_id) OR has_role(auth.uid(),'admin'::app_role));

ALTER TABLE public.whatsapp_instances ADD COLUMN IF NOT EXISTS subscription_id UUID;
ALTER TABLE public.system_config ADD COLUMN IF NOT EXISTS label TEXT;

CREATE OR REPLACE FUNCTION public.get_admin_user_activity()
RETURNS TABLE(user_id UUID, ultimo_deposito TIMESTAMPTZ, total_envios BIGINT, envios_30d BIGINT, ultimo_envio TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id AS user_id,
    (SELECT max(created_at) FROM creditos_transacoes ct WHERE ct.user_id = p.id AND ct.tipo IN ('deposito','recarga')) AS ultimo_deposito,
    COALESCE((SELECT count(*) FROM envios e JOIN lojas l ON l.id=e.loja_id WHERE l.user_id=p.id AND e.deleted_at IS NULL),0)::bigint AS total_envios,
    COALESCE((SELECT count(*) FROM envios e JOIN lojas l ON l.id=e.loja_id WHERE l.user_id=p.id AND e.deleted_at IS NULL AND e.created_at > now()-interval '30 days'),0)::bigint AS envios_30d,
    (SELECT max(e.created_at) FROM envios e JOIN lojas l ON l.id=e.loja_id WHERE l.user_id=p.id AND e.deleted_at IS NULL) AS ultimo_envio
  FROM profiles p
  WHERE has_role(auth.uid(),'admin'::app_role);
$$;
