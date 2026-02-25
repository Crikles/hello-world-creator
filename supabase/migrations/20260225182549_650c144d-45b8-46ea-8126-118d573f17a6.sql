ALTER TABLE public.envios ADD COLUMN status_label text;

ALTER PUBLICATION supabase_realtime ADD TABLE public.envios;