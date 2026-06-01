
-- Tabela de configuração de upsell por loja e tipo de email
CREATE TABLE public.upsell_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('nfe', 'coletado')),
  ativo boolean NOT NULL DEFAULT false,
  headline text DEFAULT 'Aproveite esta oferta especial!',
  sub_headline text DEFAULT 'Produto selecionado para você',
  produto_nome text DEFAULT '',
  produto_descricao text DEFAULT '',
  produto_valor text DEFAULT 'R$ 0,00',
  produto_imagem_url text DEFAULT '',
  botao_texto text DEFAULT 'Comprar Agora',
  botao_url text DEFAULT '',
  cor_headline text DEFAULT '#1e293b',
  cor_sub_headline text DEFAULT '#64748b',
  cor_nome_produto text DEFAULT '#0f172a',
  cor_descricao text DEFAULT '#475569',
  cor_valor text DEFAULT '#16a34a',
  cor_botao_bg text DEFAULT '#6366f1',
  cor_botao_texto text DEFAULT '#ffffff',
  cor_fundo text DEFAULT '#f8fafc',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (loja_id, tipo)
);

ALTER TABLE public.upsell_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own loja upsell_config"
  ON public.upsell_config
  FOR ALL
  TO authenticated
  USING (public.user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (public.user_owns_loja(auth.uid(), loja_id));

-- Custo do upsell na system_config
INSERT INTO public.system_config (key, value, label)
VALUES ('custo_upsell_email', 0.10, 'Custo por e-mail com upsell (moedas)')
ON CONFLICT (key) DO NOTHING;
