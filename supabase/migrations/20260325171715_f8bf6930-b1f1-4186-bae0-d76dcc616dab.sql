-- 1. Update handle_new_user trigger to auto-set whatsapp_verified for new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _referrer_id uuid;
  _ref_code text;
  _clean_name text;
  _phone text;
  _email text;
  _is_verified boolean;
BEGIN
  _ref_code := NEW.raw_user_meta_data->>'referral_code';

  IF _ref_code IS NOT NULL AND _ref_code != '' THEN
    SELECT id INTO _referrer_id FROM public.profiles WHERE referral_code = _ref_code;
  END IF;

  -- Sanitize full_name: strip any HTML tags
  _clean_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  _clean_name := regexp_replace(_clean_name, '<[^>]*>', '', 'g');
  _clean_name := left(trim(_clean_name), 60);

  -- Check if this user already verified during signup
  _phone := regexp_replace(COALESCE(NEW.raw_user_meta_data->>'whatsapp', ''), '\D', '', 'g');
  _email := lower(trim(COALESCE(NEW.email, '')));

  _is_verified := EXISTS (
    SELECT 1 FROM public.signup_verifications sv
    WHERE sv.status = 'verificado'
    AND (
      (_phone != '' AND regexp_replace(sv.phone, '\D', '', 'g') = _phone)
      OR (_email != '' AND lower(trim(sv.email)) = _email)
    )
  );

  INSERT INTO public.profiles (id, full_name, email, whatsapp, referred_by, whatsapp_verified)
  VALUES (
    NEW.id,
    _clean_name,
    NEW.email,
    NEW.raw_user_meta_data->>'whatsapp',
    _referrer_id,
    _is_verified
  );
  RETURN NEW;
END;
$function$;

-- 2. Re-run backfill with broader matching (email OR phone)
UPDATE public.profiles p
SET whatsapp_verified = true
WHERE whatsapp_verified = false
AND EXISTS (
  SELECT 1 FROM public.signup_verifications sv
  WHERE sv.status = 'verificado'
  AND (
    (regexp_replace(COALESCE(p.whatsapp, ''), '\D', '', 'g') != '' AND regexp_replace(sv.phone, '\D', '', 'g') = regexp_replace(p.whatsapp, '\D', '', 'g'))
    OR (COALESCE(p.email, '') != '' AND lower(trim(sv.email)) = lower(trim(p.email)))
  )
);