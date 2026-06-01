-- Desabilitar e-mail no evento "Entregue" de todos os templates
UPDATE public.postagem_eventos
SET enviar_email = false
WHERE status_label = 'Entregue';