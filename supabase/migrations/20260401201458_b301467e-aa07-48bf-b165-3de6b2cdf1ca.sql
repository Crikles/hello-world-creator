
-- Add tipo column to recovery_config
ALTER TABLE public.recovery_config
ADD COLUMN tipo text NOT NULL DEFAULT 'carrinho';

-- Drop the existing unique constraint on loja_id (isOneToOne)
ALTER TABLE public.recovery_config DROP CONSTRAINT IF EXISTS recovery_config_loja_id_key;

-- Add new unique constraint on (loja_id, tipo)
ALTER TABLE public.recovery_config
ADD CONSTRAINT recovery_config_loja_id_tipo_key UNIQUE (loja_id, tipo);

-- Add tipo column to recovery_leads
ALTER TABLE public.recovery_leads
ADD COLUMN tipo text NOT NULL DEFAULT 'carrinho';
