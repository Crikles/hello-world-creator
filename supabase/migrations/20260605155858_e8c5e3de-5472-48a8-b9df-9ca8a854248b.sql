UPDATE public.envios
SET
  ultimo_evento_ordem = 7,
  status_label = 'Chegou perto de você',
  postagem_template_id = '5836c44c-0490-4f5d-8a9d-a67956c42a24',
  proximo_avanco_em = NULL,
  status = 'em_transito'
WHERE loja_id = '86829180-1015-402d-ba18-b772cf50694e'
  AND deleted_at IS NULL;