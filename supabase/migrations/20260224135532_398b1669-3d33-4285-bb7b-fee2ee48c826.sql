
ALTER TABLE public.postagem_config
ADD COLUMN ativar_site_rastreio boolean NOT NULL DEFAULT false,
ADD COLUMN ativar_taxacao boolean NOT NULL DEFAULT false;
