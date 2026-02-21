
-- Add missing columns to empresas
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS nome_fantasia text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS numero text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS bairro text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS complemento text;

-- Add missing columns to envios
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS cliente_telefone text;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS cliente_numero text;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS cliente_bairro text;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS cliente_complemento text;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS quantidade integer NOT NULL DEFAULT 1;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS cfop text;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS ncm_sh text;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS cst text;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS unidade text NOT NULL DEFAULT 'UN';
