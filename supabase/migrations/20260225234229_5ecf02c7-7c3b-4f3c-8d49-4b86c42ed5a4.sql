
CREATE TABLE public.system_config (
  key TEXT PRIMARY KEY,
  value NUMERIC NOT NULL DEFAULT 0,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access system_config"
  ON public.system_config FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can read system_config"
  ON public.system_config FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE TRIGGER update_system_config_updated_at
  BEFORE UPDATE ON public.system_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.system_config (key, value, label) VALUES
  ('custo_nfe_email', 1, 'Nota Fiscal por email'),
  ('custo_email_rastreio', 1, 'Fluxo de rastreio por email'),
  ('custo_sms_rastreio', 0.25, 'Site de rastreio (SMS)'),
  ('custo_taxacao', 1, 'Funil de taxação'),
  ('custo_envio_email', 0.15, 'Custo unitário por email enviado');
