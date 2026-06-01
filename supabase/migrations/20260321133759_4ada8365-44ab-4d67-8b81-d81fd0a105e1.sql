
-- Add resend_email_id and updated_at to postagem_email_log
ALTER TABLE public.postagem_email_log
  ADD COLUMN IF NOT EXISTS resend_email_id TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Index for webhook lookups by resend_email_id
CREATE INDEX IF NOT EXISTS idx_postagem_email_log_resend_email_id
  ON public.postagem_email_log (resend_email_id)
  WHERE resend_email_id IS NOT NULL;

-- Index for health dashboard queries (negative statuses)
CREATE INDEX IF NOT EXISTS idx_postagem_email_log_status
  ON public.postagem_email_log (status);

-- Allow service_role to update email logs (for webhook)
CREATE POLICY "Service role can manage email logs"
  ON public.postagem_email_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
