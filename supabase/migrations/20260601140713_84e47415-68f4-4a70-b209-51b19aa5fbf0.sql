-- ═══════════════════════════════════════════════════════════
-- PART A: Profile columns + system_config + debit_blocks + RPC
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_verified BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preco_envio_custom NUMERIC;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preco_recarga_custom NUMERIC;

-- system_config: chave-valor JSONB para configurações globais
CREATE TABLE IF NOT EXISTS public.system_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.system_config TO anon, authenticated;
GRANT ALL ON public.system_config TO service_role;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read system_config" ON public.system_config;
CREATE POLICY "Public read system_config" ON public.system_config FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage system_config" ON public.system_config;
CREATE POLICY "Admins manage system_config" ON public.system_config FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- debit_blocks: bloqueios de cobrança por usuário
CREATE TABLE IF NOT EXISTS public.debit_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved BOOLEAN NOT NULL DEFAULT false
);
GRANT SELECT ON public.debit_blocks TO authenticated;
GRANT ALL ON public.debit_blocks TO service_role;
ALTER TABLE public.debit_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own debit_blocks" ON public.debit_blocks;
CREATE POLICY "Users view own debit_blocks" ON public.debit_blocks FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins manage debit_blocks" ON public.debit_blocks;
CREATE POLICY "Admins manage debit_blocks" ON public.debit_blocks FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_my_debit_blocks()
RETURNS SETOF public.debit_blocks
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.debit_blocks
  WHERE user_id = auth.uid() AND resolved = false
    AND (blocked_until IS NULL OR blocked_until > now())
  ORDER BY created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_debit_diagnostics()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  RETURN jsonb_build_object(
    'total_blocks', (SELECT COUNT(*) FROM public.debit_blocks WHERE resolved = false),
    'last_24h', (SELECT COUNT(*) FROM public.debit_blocks WHERE created_at > now() - interval '24 hours')
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- PART B: Postagens (templates + config + email log)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.postagem_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  html TEXT NOT NULL DEFAULT '',
  evento TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.postagem_templates TO authenticated;
GRANT ALL ON public.postagem_templates TO service_role;
ALTER TABLE public.postagem_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own loja templates" ON public.postagem_templates;
CREATE POLICY "Users own loja templates" ON public.postagem_templates FOR ALL
  USING (public.user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (public.user_owns_loja(auth.uid(), loja_id));

CREATE TABLE IF NOT EXISTS public.postagem_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID NOT NULL UNIQUE REFERENCES public.lojas(id) ON DELETE CASCADE,
  template_ativo_id UUID REFERENCES public.postagem_templates(id) ON DELETE SET NULL,
  enviar_emails BOOLEAN NOT NULL DEFAULT true,
  enviar_nfe_email BOOLEAN NOT NULL DEFAULT true,
  origem_cidade TEXT,
  origem_estado TEXT,
  failed_delivery_cost NUMERIC DEFAULT 0,
  failed_delivery_template_id UUID REFERENCES public.postagem_templates(id) ON DELETE SET NULL,
  taxacao_template_id UUID REFERENCES public.postagem_templates(id) ON DELETE SET NULL,
  taxacao_valor NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.postagem_config TO authenticated;
GRANT ALL ON public.postagem_config TO service_role;
ALTER TABLE public.postagem_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own loja config" ON public.postagem_config;
CREATE POLICY "Users own loja config" ON public.postagem_config FOR ALL
  USING (public.user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (public.user_owns_loja(auth.uid(), loja_id));

CREATE TABLE IF NOT EXISTS public.postagem_email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID REFERENCES public.lojas(id) ON DELETE CASCADE,
  envio_id UUID REFERENCES public.envios(id) ON DELETE SET NULL,
  destinatario TEXT NOT NULL,
  evento TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  resend_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.postagem_email_log TO authenticated;
GRANT ALL ON public.postagem_email_log TO service_role;
ALTER TABLE public.postagem_email_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own loja email_log" ON public.postagem_email_log;
CREATE POLICY "Users view own loja email_log" ON public.postagem_email_log FOR SELECT
  USING (public.user_owns_loja(auth.uid(), loja_id));
DROP POLICY IF EXISTS "Admins view all email_log" ON public.postagem_email_log;
CREATE POLICY "Admins view all email_log" ON public.postagem_email_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- ═══════════════════════════════════════════════════════════
-- PART C: SMS templates + leads
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.sms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  evento TEXT,
  mensagem TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sms_templates TO authenticated;
GRANT ALL ON public.sms_templates TO service_role;
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read sms_templates" ON public.sms_templates;
CREATE POLICY "Authenticated read sms_templates" ON public.sms_templates FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage sms_templates" ON public.sms_templates;
CREATE POLICY "Admins manage sms_templates" ON public.sms_templates FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  nome TEXT,
  telefone TEXT,
  origem TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.leads TO authenticated;
GRANT INSERT ON public.leads TO anon;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone insert leads" ON public.leads;
CREATE POLICY "Anyone insert leads" ON public.leads FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Admins view leads" ON public.leads;
CREATE POLICY "Admins view leads" ON public.leads FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- ═══════════════════════════════════════════════════════════
-- PART D: Push notifications
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL UNIQUE,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  codigo_rastreio TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.push_subscriptions TO anon, authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public insert push_subs" ON public.push_subscriptions;
CREATE POLICY "Public insert push_subs" ON public.push_subscriptions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Public select push_subs" ON public.push_subscriptions;
CREATE POLICY "Public select push_subs" ON public.push_subscriptions FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.push_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  icon_url TEXT DEFAULT '/favicon.ico',
  badge_url TEXT DEFAULT '/favicon.ico',
  default_url TEXT DEFAULT '/',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.push_notification_settings TO authenticated;
GRANT ALL ON public.push_notification_settings TO service_role;
ALTER TABLE public.push_notification_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated full push_settings" ON public.push_notification_settings;
CREATE POLICY "Authenticated full push_settings" ON public.push_notification_settings FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.push_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT,
  icon_url TEXT,
  total_sent INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.push_notification_log TO authenticated;
GRANT ALL ON public.push_notification_log TO service_role;
ALTER TABLE public.push_notification_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated full push_log" ON public.push_notification_log;
CREATE POLICY "Authenticated full push_log" ON public.push_notification_log FOR ALL USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════
-- PART E: PIX payments + Shopify integrations + checkout integrations
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.pix_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id TEXT UNIQUE,
  amount_cents INTEGER NOT NULL,
  moedas NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  qr_code_base64 TEXT,
  copy_paste TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_pix_payments_transaction_id ON public.pix_payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_pix_payments_user_id ON public.pix_payments(user_id);
GRANT SELECT ON public.pix_payments TO authenticated;
GRANT ALL ON public.pix_payments TO service_role;
ALTER TABLE public.pix_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own pix" ON public.pix_payments;
CREATE POLICY "Users view own pix" ON public.pix_payments FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins view all pix" ON public.pix_payments;
CREATE POLICY "Admins view all pix" ON public.pix_payments FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Service manage pix" ON public.pix_payments;
CREATE POLICY "Service manage pix" ON public.pix_payments FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS public.shopify_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  shop_domain TEXT NOT NULL,
  access_token TEXT,
  webhook_secret TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopify_integrations TO authenticated;
GRANT ALL ON public.shopify_integrations TO service_role;
ALTER TABLE public.shopify_integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own loja shopify" ON public.shopify_integrations;
CREATE POLICY "Users own loja shopify" ON public.shopify_integrations FOR ALL
  USING (public.user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (public.user_owns_loja(auth.uid(), loja_id));

CREATE TABLE IF NOT EXISTS public.checkout_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  api_key TEXT,
  webhook_secret TEXT,
  config JSONB DEFAULT '{}'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (loja_id, provider)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkout_integrations TO authenticated;
GRANT ALL ON public.checkout_integrations TO service_role;
ALTER TABLE public.checkout_integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own loja checkout_integrations" ON public.checkout_integrations;
CREATE POLICY "Users own loja checkout_integrations" ON public.checkout_integrations FOR ALL
  USING (public.user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (public.user_owns_loja(auth.uid(), loja_id));

-- ═══════════════════════════════════════════════════════════
-- PART F: WhatsApp (instances + message log)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID REFERENCES public.lojas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  instance_token TEXT,
  numero TEXT,
  label TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_instances TO authenticated;
GRANT ALL ON public.whatsapp_instances TO service_role;
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own whatsapp_instances" ON public.whatsapp_instances;
CREATE POLICY "Users own whatsapp_instances" ON public.whatsapp_instances FOR ALL
  USING (auth.uid() = user_id OR (loja_id IS NOT NULL AND public.user_owns_loja(auth.uid(), loja_id)))
  WITH CHECK (auth.uid() = user_id OR (loja_id IS NOT NULL AND public.user_owns_loja(auth.uid(), loja_id)));
DROP POLICY IF EXISTS "Admins manage whatsapp_instances" ON public.whatsapp_instances;
CREATE POLICY "Admins manage whatsapp_instances" ON public.whatsapp_instances FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.whatsapp_message_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID REFERENCES public.lojas(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  destinatario TEXT NOT NULL,
  mensagem TEXT,
  evento TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.whatsapp_message_log TO authenticated;
GRANT ALL ON public.whatsapp_message_log TO service_role;
ALTER TABLE public.whatsapp_message_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own whatsapp_log" ON public.whatsapp_message_log;
CREATE POLICY "Users view own whatsapp_log" ON public.whatsapp_message_log FOR SELECT
  USING (auth.uid() = user_id OR (loja_id IS NOT NULL AND public.user_owns_loja(auth.uid(), loja_id)));
DROP POLICY IF EXISTS "Admins view all whatsapp_log" ON public.whatsapp_message_log;
CREATE POLICY "Admins view all whatsapp_log" ON public.whatsapp_message_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- ═══════════════════════════════════════════════════════════
-- Triggers de updated_at
-- ═══════════════════════════════════════════════════════════
DO $$ DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'postagem_templates','postagem_config','sms_templates',
    'shopify_integrations','checkout_integrations','whatsapp_instances',
    'system_config','push_notification_settings'
  ]) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t, t);
  END LOOP;
END $$;