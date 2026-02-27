
CREATE TABLE IF NOT EXISTS public.pix_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  transaction_id text UNIQUE,
  amount_cents integer NOT NULL,
  moedas numeric NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  qr_code_base64 text,
  copy_paste text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_pix_payments_transaction_id ON public.pix_payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_pix_payments_user_id ON public.pix_payments(user_id);

ALTER TABLE public.pix_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pix_payments"
ON public.pix_payments FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage pix_payments"
ON public.pix_payments FOR ALL
USING (auth.role() = 'service_role');
