ALTER TABLE public.envios REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.envios;