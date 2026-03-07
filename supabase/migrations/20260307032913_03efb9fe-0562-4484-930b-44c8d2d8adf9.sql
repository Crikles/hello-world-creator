
-- Add referral columns to profiles
ALTER TABLE public.profiles ADD COLUMN referral_code text UNIQUE;
ALTER TABLE public.profiles ADD COLUMN referred_by uuid;

-- Trigger to auto-generate referral code on insert
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := upper(substr(md5(NEW.id::text || clock_timestamp()::text), 1, 8));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.generate_referral_code();

-- Referral earnings table
CREATE TABLE public.referral_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referred_id uuid NOT NULL,
  pix_payment_id uuid NOT NULL,
  amount_earned numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own referral earnings" ON public.referral_earnings
  FOR SELECT TO authenticated USING (auth.uid() = referrer_id);

CREATE POLICY "Service role manage referral_earnings" ON public.referral_earnings
  FOR ALL USING (auth.role() = 'service_role'::text);
