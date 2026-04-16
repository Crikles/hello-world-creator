-- Persistent lock table for retry executions
CREATE TABLE IF NOT EXISTS public.retry_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'running',
  total_pendentes integer NOT NULL DEFAULT 0,
  processados integer NOT NULL DEFAULT 0,
  sucesso integer NOT NULL DEFAULT 0,
  falhas integer NOT NULL DEFAULT 0,
  mensagem text,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes')
);

CREATE INDEX IF NOT EXISTS idx_retry_execucoes_loja_status
  ON public.retry_execucoes (loja_id, status, expires_at DESC);

ALTER TABLE public.retry_execucoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own loja retry_execucoes" ON public.retry_execucoes;
CREATE POLICY "Users view own loja retry_execucoes"
  ON public.retry_execucoes FOR SELECT
  USING (public.user_owns_loja(auth.uid(), loja_id));

DROP POLICY IF EXISTS "Service role manage retry_execucoes" ON public.retry_execucoes;
CREATE POLICY "Service role manage retry_execucoes"
  ON public.retry_execucoes FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins full access retry_execucoes" ON public.retry_execucoes;
CREATE POLICY "Admins full access retry_execucoes"
  ON public.retry_execucoes FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger to keep updated_at fresh
DROP TRIGGER IF EXISTS trg_retry_execucoes_updated_at ON public.retry_execucoes;
CREATE TRIGGER trg_retry_execucoes_updated_at
  BEFORE UPDATE ON public.retry_execucoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for log + lock so the frontend reflects changes instantly
ALTER TABLE public.confirmacao_pagamento_log REPLICA IDENTITY FULL;
ALTER TABLE public.retry_execucoes REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.confirmacao_pagamento_log;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.retry_execucoes;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;