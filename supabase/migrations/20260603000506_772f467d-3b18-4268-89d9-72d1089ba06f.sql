
CREATE TABLE public.restore_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  tables_processed integer DEFAULT 0,
  total_rows bigint DEFAULT 0,
  source_folder text,
  mode text NOT NULL DEFAULT 'latest',
  error text,
  details jsonb
);

GRANT SELECT ON public.restore_runs TO authenticated;
GRANT ALL ON public.restore_runs TO service_role;

ALTER TABLE public.restore_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view restore runs"
ON public.restore_runs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
