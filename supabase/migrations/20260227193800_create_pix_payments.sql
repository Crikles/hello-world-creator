-- Create pix_payments table to track PIX payment requests for credit purchases
CREATE TABLE IF NOT EXISTS pix_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id text UNIQUE,
  amount_cents integer NOT NULL,
  moedas numeric NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  qr_code_base64 text,
  copy_paste text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

-- Index for fast lookup by transaction_id (webhook)
CREATE INDEX IF NOT EXISTS idx_pix_payments_transaction_id ON pix_payments(transaction_id);
-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_pix_payments_user_id ON pix_payments(user_id);

-- RLS
ALTER TABLE pix_payments ENABLE ROW LEVEL SECURITY;

-- Users can view their own pix payments
CREATE POLICY "Users can view own pix_payments"
  ON pix_payments FOR SELECT
  USING (auth.uid() = user_id);

-- Only service_role (edge functions) can insert/update
CREATE POLICY "Service role can manage pix_payments"
  ON pix_payments FOR ALL
  USING (auth.role() = 'service_role');
