
-- admin_cashback_processed
CREATE TABLE IF NOT EXISTS public.admin_cashback_processed (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  total_clients INTEGER NOT NULL DEFAULT 0,
  total_cashback NUMERIC NOT NULL DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  processed_by UUID NOT NULL,
  destinatarios TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_cashback_processed TO authenticated;
GRANT ALL ON public.admin_cashback_processed TO service_role;
ALTER TABLE public.admin_cashback_processed ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage admin_cashback_processed" ON public.admin_cashback_processed
  FOR ALL USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- admin_payment_webhooks
CREATE TABLE IF NOT EXISTS public.admin_payment_webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL,
  label TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_payment_webhooks TO authenticated;
GRANT ALL ON public.admin_payment_webhooks TO service_role;
ALTER TABLE public.admin_payment_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage admin_payment_webhooks" ON public.admin_payment_webhooks
  FOR ALL USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- push_templates
CREATE TABLE IF NOT EXISTS public.push_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  titulo TEXT NOT NULL DEFAULT '',
  mensagem TEXT NOT NULL DEFAULT '',
  url TEXT DEFAULT '',
  icon_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_templates TO authenticated;
GRANT ALL ON public.push_templates TO service_role;
ALTER TABLE public.push_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage push_templates" ON public.push_templates
  FOR ALL USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Authenticated read push_templates" ON public.push_templates
  FOR SELECT USING (true);

-- system_config text_value
ALTER TABLE public.system_config
  ADD COLUMN IF NOT EXISTS text_value TEXT;

-- sms_templates extras
ALTER TABLE public.sms_templates
  ADD COLUMN IF NOT EXISTS status_key TEXT,
  ADD COLUMN IF NOT EXISTS status_label TEXT;
