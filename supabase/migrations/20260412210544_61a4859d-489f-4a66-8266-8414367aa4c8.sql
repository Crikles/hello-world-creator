
-- Delete old events from all non-system copies of Template Prolongado
DELETE FROM public.postagem_eventos 
WHERE template_id IN (
  SELECT id FROM public.postagem_templates 
  WHERE nome = 'Template Prolongado' AND is_system = false
);

-- Insert 16 new events for each non-system copy
INSERT INTO public.postagem_eventos (template_id, nome, descricao, status_label, ordem, delay_horas, enviar_email, enviar_nfe_pdf, is_final, assunto_email, corpo_email)
SELECT 
  t.id,
  e.nome,
  e.descricao,
  e.status_label,
  e.ordem,
  e.delay_horas,
  e.enviar_email,
  e.enviar_nfe_pdf,
  e.is_final,
  e.assunto_email,
  e.corpo_email
FROM public.postagem_templates t
CROSS JOIN public.postagem_eventos e
WHERE t.nome = 'Template Prolongado' 
  AND t.is_system = false
  AND e.template_id = '00000000-0000-0000-0000-000000000005';
