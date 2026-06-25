ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS nfe_cobrado boolean NOT NULL DEFAULT false;
-- Marca como já cobrado envios que já tiveram NF-e enviada por e-mail (fluxo antigo já debitou)
UPDATE public.envios e
SET nfe_cobrado = true
WHERE nfe_cobrado = false
  AND EXISTS (
    SELECT 1 FROM public.postagem_email_log pel
    JOIN public.postagem_eventos pev ON pev.id = pel.evento_id
    WHERE pel.envio_id = e.id AND pev.enviar_nfe_pdf = true AND pel.status = 'sent'
  );