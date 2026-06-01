
-- recovery_config
CREATE TABLE IF NOT EXISTS public.recovery_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL,
  tipo TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT false,
  delay_minutos INTEGER NOT NULL DEFAULT 30,
  assunto_email TEXT NOT NULL DEFAULT '',
  corpo_email TEXT NOT NULL DEFAULT '',
  cupom_ativo BOOLEAN NOT NULL DEFAULT false,
  codigo_cupom TEXT,
  descricao_cupom TEXT,
  beneficio_principal TEXT,
  beneficio_1 TEXT,
  beneficio_2 TEXT,
  beneficio_3 TEXT,
  garantia TEXT,
  ps_reforco_urgencia TEXT,
  enviar_sms BOOLEAN NOT NULL DEFAULT false,
  sms_template TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (loja_id, tipo)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recovery_config TO authenticated;
GRANT ALL ON public.recovery_config TO service_role;
ALTER TABLE public.recovery_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own loja recovery_config" ON public.recovery_config
  FOR ALL USING (user_owns_loja(auth.uid(), loja_id)) WITH CHECK (user_owns_loja(auth.uid(), loja_id));

-- recovery_leads
CREATE TABLE IF NOT EXISTS public.recovery_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL,
  tipo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  nome TEXT,
  email TEXT,
  telefone TEXT,
  valor NUMERIC DEFAULT 0,
  produto TEXT,
  email_sent_at TIMESTAMPTZ,
  sms_sent_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recovery_leads TO authenticated;
GRANT ALL ON public.recovery_leads TO service_role;
ALTER TABLE public.recovery_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own loja recovery_leads" ON public.recovery_leads
  FOR ALL USING (user_owns_loja(auth.uid(), loja_id)) WITH CHECK (user_owns_loja(auth.uid(), loja_id));
CREATE INDEX IF NOT EXISTS idx_recovery_leads_loja_tipo ON public.recovery_leads(loja_id, tipo, created_at DESC);

-- postagem_templates extras
ALTER TABLE public.postagem_templates
  ADD COLUMN IF NOT EXISTS tipo TEXT,
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS descricao TEXT;

-- postagem_config extras
ALTER TABLE public.postagem_config
  ADD COLUMN IF NOT EXISTS ativar_vizinho BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_vendedor TEXT,
  ADD COLUMN IF NOT EXISTS cor_primaria TEXT DEFAULT '#6366f1',
  ADD COLUMN IF NOT EXISTS cor_botao_cta TEXT DEFAULT '#1a1a1a';

-- envios extra
ALTER TABLE public.envios
  ADD COLUMN IF NOT EXISTS postagem_template_id UUID;

-- lojas extra
ALTER TABLE public.lojas
  ADD COLUMN IF NOT EXISTS logistica_provider TEXT DEFAULT 'jl';

-- checkout_integrations.provider opcional
ALTER TABLE public.checkout_integrations
  ALTER COLUMN provider DROP NOT NULL;
