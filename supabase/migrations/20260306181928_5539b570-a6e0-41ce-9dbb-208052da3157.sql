ALTER TABLE public.empresas ALTER COLUMN cnpj DROP NOT NULL;
ALTER TABLE public.empresas ALTER COLUMN razao_social DROP NOT NULL;
ALTER TABLE public.empresas ALTER COLUMN cnpj SET DEFAULT '';