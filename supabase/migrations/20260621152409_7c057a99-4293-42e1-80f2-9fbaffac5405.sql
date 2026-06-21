
ALTER TABLE public.global_flow_config
  ADD COLUMN IF NOT EXISTS pais_origem text NOT NULL DEFAULT 'CN',
  ADD COLUMN IF NOT EXISTS pais_origem_nome text NOT NULL DEFAULT 'China',
  ADD COLUMN IF NOT EXISTS confirmacao_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS confirmacao_sms boolean NOT NULL DEFAULT false;
