ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS email_invalid boolean NOT NULL DEFAULT false;

-- Backfill imediato: marcar os 2 envios com domínio digitado errado para parar o loop
UPDATE public.envios SET email_invalid = true
WHERE cliente_email IN ('mauriciomalaquiasmalaquias824@gmail.como9','idenicecardoso490z@gmail.com99');