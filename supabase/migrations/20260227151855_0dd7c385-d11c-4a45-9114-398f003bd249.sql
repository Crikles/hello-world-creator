
-- Enable realtime for creditos table
ALTER PUBLICATION supabase_realtime ADD TABLE public.creditos;

-- Add soft delete column to envios
ALTER TABLE public.envios ADD COLUMN deleted_at timestamptz DEFAULT NULL;
