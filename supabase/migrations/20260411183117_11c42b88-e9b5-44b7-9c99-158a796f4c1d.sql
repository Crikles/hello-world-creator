
-- Table: confirmacao_pagamento_config
CREATE TABLE public.confirmacao_pagamento_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT false,
  enviar_email boolean NOT NULL DEFAULT true,
  enviar_sms boolean NOT NULL DEFAULT true,
  assunto_email text NOT NULL DEFAULT 'Pagamento Confirmado! ✅ Seu pedido {{produto}} foi aprovado',
  corpo_email text NOT NULL DEFAULT '',
  sms_template text NOT NULL DEFAULT 'Ola {{nome}}! Seu pagamento de R${{valor}} foi confirmado. Obrigado pela compra!',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(loja_id)
);

ALTER TABLE public.confirmacao_pagamento_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own loja confirmacao_pagamento_config"
  ON public.confirmacao_pagamento_config FOR ALL
  USING (user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (user_owns_loja(auth.uid(), loja_id));

CREATE TRIGGER update_confirmacao_pagamento_config_updated_at
  BEFORE UPDATE ON public.confirmacao_pagamento_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Table: confirmacao_pagamento_log
CREATE TABLE public.confirmacao_pagamento_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  pedido_id uuid REFERENCES public.pedidos(id),
  tipo text NOT NULL DEFAULT 'email',
  status text NOT NULL DEFAULT 'pending',
  custo numeric NOT NULL DEFAULT 0,
  destinatario text NOT NULL,
  error_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.confirmacao_pagamento_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own loja confirmacao_pagamento_log"
  ON public.confirmacao_pagamento_log FOR SELECT
  USING (user_owns_loja(auth.uid(), loja_id));

CREATE POLICY "Service role manage confirmacao_pagamento_log"
  ON public.confirmacao_pagamento_log FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Insert default costs
INSERT INTO public.system_config (key, value, label) VALUES
  ('custo_confirmacao_email', 0.50, 'Custo por email de confirmação de pagamento'),
  ('custo_confirmacao_sms', 0.12, 'Custo por SMS de confirmação de pagamento')
ON CONFLICT (key) DO NOTHING;
