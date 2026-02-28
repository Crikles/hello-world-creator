
-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Add auto_envio column to postagem_config
ALTER TABLE public.postagem_config ADD COLUMN IF NOT EXISTS auto_envio boolean DEFAULT false;
