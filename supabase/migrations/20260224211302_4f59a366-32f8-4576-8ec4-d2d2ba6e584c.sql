-- Add FK between envios.empresa_id and empresas.id (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'envios_empresa_id_fkey'
    AND table_name = 'envios'
  ) THEN
    ALTER TABLE public.envios
      ADD CONSTRAINT envios_empresa_id_fkey
      FOREIGN KEY (empresa_id) REFERENCES public.empresas(id)
      ON DELETE SET NULL;
  END IF;
END $$;