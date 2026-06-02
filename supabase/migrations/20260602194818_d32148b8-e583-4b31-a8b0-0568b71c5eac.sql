UPDATE public.postagem_eventos
SET 
  status_label = regexp_replace(status_label, '\s*\(1ª tentativa\)\s*', '', 'gi'),
  assunto_email = regexp_replace(assunto_email, '\s*[—-]\s*1ª tentativa\s*', '', 'gi')
WHERE status_label ILIKE '%1ª tentativa%' OR assunto_email ILIKE '%1ª tentativa%';