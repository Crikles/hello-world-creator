ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_verified boolean NOT NULL DEFAULT false;

-- Backfill: mark existing verified users
UPDATE public.profiles p
SET whatsapp_verified = true
WHERE EXISTS (
  SELECT 1 FROM public.signup_verifications sv
  WHERE sv.status = 'verificado'
  AND (
    regexp_replace(sv.phone, '\D', '', 'g') = regexp_replace(COALESCE(p.whatsapp, ''), '\D', '', 'g')
    OR lower(trim(sv.email)) = lower(trim(COALESCE(p.email, '')))
  )
  AND regexp_replace(COALESCE(p.whatsapp, ''), '\D', '', 'g') != ''
);