
CREATE TABLE public.admin_cashback_processed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  total_clients integer NOT NULL DEFAULT 0,
  total_cashback numeric NOT NULL DEFAULT 0,
  period_start timestamp with time zone NOT NULL,
  period_end timestamp with time zone NOT NULL,
  processed_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_by uuid NOT NULL,
  destinatarios jsonb NOT NULL DEFAULT '[]'::jsonb
);

ALTER TABLE public.admin_cashback_processed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access admin_cashback_processed"
  ON public.admin_cashback_processed
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
