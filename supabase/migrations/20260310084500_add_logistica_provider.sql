-- Migration to add logistica_provider to lojas table

ALTER TABLE public.lojas
ADD COLUMN logistica_provider TEXT NOT NULL DEFAULT 'jl';

COMMENT ON COLUMN public.lojas.logistica_provider IS 'jl ou jadlog';
