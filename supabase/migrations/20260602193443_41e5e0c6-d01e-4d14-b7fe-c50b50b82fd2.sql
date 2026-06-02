ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS status_label text;
NOTIFY pgrst, 'reload schema';