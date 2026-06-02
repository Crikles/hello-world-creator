CREATE TABLE IF NOT EXISTS public.backup_state (
  table_name text PRIMARY KEY,
  last_backup_at timestamptz NOT NULL DEFAULT '1970-01-01'::timestamptz,
  last_run_at timestamptz,
  last_rows_count bigint DEFAULT 0,
  last_status text,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.backup_state TO authenticated;
GRANT ALL ON public.backup_state TO service_role;

ALTER TABLE public.backup_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view backup state"
ON public.backup_state FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  tables_processed int DEFAULT 0,
  total_rows bigint DEFAULT 0,
  total_bytes bigint DEFAULT 0,
  drive_folder_id text,
  error text,
  details jsonb
);

GRANT SELECT ON public.backup_runs TO authenticated;
GRANT ALL ON public.backup_runs TO service_role;

ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view backup runs"
ON public.backup_runs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;