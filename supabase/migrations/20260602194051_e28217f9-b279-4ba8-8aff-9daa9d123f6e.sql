UPDATE public.postagem_eventos
SET corpo_email = regexp_replace(
  substring(corpo_email from 'color:#555;">(.*?)</div>'),
  '<br\s*/?>', E'\n', 'gi'
)
WHERE corpo_email LIKE '<!DOCTYPE%';

UPDATE public.postagem_eventos
SET corpo_email = regexp_replace(corpo_email, '<strong>(.*?)</strong>', '**\1**', 'g')
WHERE corpo_email ~ '<strong>';

DROP FUNCTION IF EXISTS public._build_postagem_email_html(text, text, text, text, boolean);

NOTIFY pgrst, 'reload schema';