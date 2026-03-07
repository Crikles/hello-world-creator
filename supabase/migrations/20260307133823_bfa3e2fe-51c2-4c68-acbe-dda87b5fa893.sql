
ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_price NUMERIC DEFAULT 29.99;
