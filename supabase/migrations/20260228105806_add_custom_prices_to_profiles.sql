ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_prices JSONB DEFAULT '{}'::jsonb;
