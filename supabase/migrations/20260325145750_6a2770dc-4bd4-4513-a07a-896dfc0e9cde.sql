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
BEGIN
  _ref_code := NEW.raw_user_meta_data->>'referral_code';

  IF _ref_code IS NOT NULL AND _ref_code != '' THEN
    SELECT id INTO _referrer_id FROM public.profiles WHERE referral_code = _ref_code;
  END IF;

  -- Sanitize full_name: strip any HTML tags
  _clean_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  _clean_name := regexp_replace(_clean_name, '<[^>]*>', '', 'g');
  _clean_name := left(trim(_clean_name), 60);

  INSERT INTO public.profiles (id, full_name, email, whatsapp, referred_by)
  VALUES (
    NEW.id,
    _clean_name,
    NEW.email,
    NEW.raw_user_meta_data->>'whatsapp',
    _referrer_id
  );
  RETURN NEW;
END;
$function$;