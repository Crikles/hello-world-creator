
CREATE TABLE public.global_flow_config (
  loja_id uuid PRIMARY KEY REFERENCES public.lojas(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT false,
  idioma text NOT NULL DEFAULT 'en' CHECK (idioma IN ('en','es')),
  enviar_email boolean NOT NULL DEFAULT true,
  enviar_sms boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.global_flow_config TO authenticated;
GRANT ALL ON public.global_flow_config TO service_role;

ALTER TABLE public.global_flow_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own loja global_flow_config"
  ON public.global_flow_config FOR ALL
  TO authenticated
  USING (public.user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (public.user_owns_loja(auth.uid(), loja_id));

CREATE POLICY "Admins manage all global_flow_config"
  ON public.global_flow_config FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_global_flow_config_updated_at
  BEFORE UPDATE ON public.global_flow_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.envios
  ADD COLUMN IF NOT EXISTS is_international boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS global_flow_lang text CHECK (global_flow_lang IN ('en','es'));
