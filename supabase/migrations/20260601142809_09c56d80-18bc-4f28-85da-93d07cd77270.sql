
CREATE TABLE IF NOT EXISTS public.upsell_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL,
  tipo TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT false,
  headline TEXT DEFAULT '',
  sub_headline TEXT DEFAULT '',
  produto_nome TEXT DEFAULT '',
  produto_descricao TEXT DEFAULT '',
  produto_valor TEXT DEFAULT '',
  produto_imagem_url TEXT DEFAULT '',
  botao_texto TEXT DEFAULT '',
  botao_url TEXT DEFAULT '',
  cor_headline TEXT DEFAULT '#1e293b',
  cor_sub_headline TEXT DEFAULT '#64748b',
  cor_nome_produto TEXT DEFAULT '#0f172a',
  cor_descricao TEXT DEFAULT '#475569',
  cor_valor TEXT DEFAULT '#16a34a',
  cor_botao_bg TEXT DEFAULT '#6366f1',
  cor_botao_texto TEXT DEFAULT '#ffffff',
  cor_fundo TEXT DEFAULT '#f8fafc',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (loja_id, tipo)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.upsell_config TO authenticated;
GRANT ALL ON public.upsell_config TO service_role;
ALTER TABLE public.upsell_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own loja upsell_config" ON public.upsell_config
  FOR ALL USING (user_owns_loja(auth.uid(), loja_id)) WITH CHECK (user_owns_loja(auth.uid(), loja_id));
