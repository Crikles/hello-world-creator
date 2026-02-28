CREATE TABLE public.checkout_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL,
  checkout_id text NOT NULL,
  ativo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(loja_id, checkout_id)
);

ALTER TABLE public.checkout_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own loja checkout_integrations"
  ON public.checkout_integrations FOR ALL
  USING (user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (user_owns_loja(auth.uid(), loja_id));