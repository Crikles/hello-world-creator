
-- Recovery config per store
CREATE TABLE public.recovery_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT false,
  delay_minutos integer NOT NULL DEFAULT 30,
  assunto_email text NOT NULL DEFAULT '{{nome_cliente}}, você esqueceu algo 👀',
  corpo_email text NOT NULL DEFAULT '',
  enviar_sms boolean NOT NULL DEFAULT false,
  sms_template text DEFAULT '',
  cupom_ativo boolean NOT NULL DEFAULT false,
  codigo_cupom text DEFAULT '',
  descricao_cupom text DEFAULT '',
  beneficio_principal text DEFAULT '',
  beneficio_1 text DEFAULT '',
  beneficio_2 text DEFAULT '',
  beneficio_3 text DEFAULT '',
  garantia text DEFAULT '',
  ps_reforco_urgencia text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(loja_id)
);

ALTER TABLE public.recovery_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own loja recovery_config"
  ON public.recovery_config FOR ALL
  USING (user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (user_owns_loja(auth.uid(), loja_id));

CREATE POLICY "Service role full access recovery_config"
  ON public.recovery_config FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER update_recovery_config_updated_at
  BEFORE UPDATE ON public.recovery_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Recovery leads captured by webhook
CREATE TABLE public.recovery_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  customer_name text NOT NULL DEFAULT '',
  customer_email text NOT NULL,
  customer_phone text DEFAULT '',
  products jsonb DEFAULT '[]'::jsonb,
  total_value numeric NOT NULL DEFAULT 0,
  checkout_url text DEFAULT '',
  raw_payload jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pendente',
  email_sent_at timestamptz,
  sms_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recovery_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own loja recovery_leads"
  ON public.recovery_leads FOR ALL
  USING (user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (user_owns_loja(auth.uid(), loja_id));

CREATE POLICY "Service role full access recovery_leads"
  ON public.recovery_leads FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX idx_recovery_leads_loja_status ON public.recovery_leads(loja_id, status);
CREATE INDEX idx_recovery_leads_created ON public.recovery_leads(created_at DESC);
