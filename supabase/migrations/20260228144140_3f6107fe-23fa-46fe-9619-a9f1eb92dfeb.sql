
-- Add custom_prices JSONB column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_prices JSONB DEFAULT '{}'::jsonb;

-- Allow admins to update any profile (needed for setting custom_prices)
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
