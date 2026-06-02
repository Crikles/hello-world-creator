
-- 1. Adiciona coluna webhook_token
ALTER TABLE public.lojas
  ADD COLUMN IF NOT EXISTS webhook_token text;

-- 2. Preenche tokens para lojas existentes
UPDATE public.lojas
SET webhook_token = encode(gen_random_bytes(18), 'hex')
WHERE webhook_token IS NULL;

-- 3. Garante unicidade e default
ALTER TABLE public.lojas
  ALTER COLUMN webhook_token SET DEFAULT encode(gen_random_bytes(18), 'hex'),
  ALTER COLUMN webhook_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS lojas_webhook_token_key
  ON public.lojas(webhook_token);
