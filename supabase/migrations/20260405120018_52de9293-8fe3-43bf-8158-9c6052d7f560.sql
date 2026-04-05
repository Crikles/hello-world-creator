ALTER TABLE public.recovery_leads
  ADD COLUMN IF NOT EXISTS pix_code text DEFAULT '',
  ADD COLUMN IF NOT EXISTS pix_qrcode_url text DEFAULT '';