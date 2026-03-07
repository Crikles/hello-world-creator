
ALTER TABLE public.postagem_config
  ADD COLUMN IF NOT EXISTS whatsapp_image_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_reply_text TEXT DEFAULT 'Quero acompanhar meu pedido';
