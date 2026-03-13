
CREATE TABLE public.batch_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  current_item integer NOT NULL DEFAULT 0,
  total_items integer NOT NULL DEFAULT 0,
  cancelled boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(loja_id)
);

ALTER TABLE public.batch_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own loja batch_progress"
  ON public.batch_progress
  FOR ALL
  USING (user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (user_owns_loja(auth.uid(), loja_id));

ALTER PUBLICATION supabase_realtime ADD TABLE public.batch_progress;
