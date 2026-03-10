-- Adicionar coluna postagem_template_id à tabela envios
ALTER TABLE public.envios 
ADD COLUMN IF NOT EXISTS postagem_template_id UUID REFERENCES public.postagem_templates(id);

-- Opcional: Para manter integridade e facilitar visualização, você pode definir um comentário
COMMENT ON COLUMN public.envios.postagem_template_id IS 'ID do template de postagem ativo no momento da criação deste envio. Usado para travar o funil de eventos.';
