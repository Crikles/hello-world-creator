CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_phone text;
  v_verified boolean := false;
BEGIN
  v_phone := regexp_replace(COALESCE(NEW.raw_user_meta_data->>'whatsapp', ''), '\D', '', 'g');

  IF v_phone <> '' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.signup_verifications
      WHERE phone = v_phone
        AND status = 'verificado'
        AND (email = lower(NEW.email) OR email IS NULL)
      ORDER BY verified_at DESC NULLS LAST
      LIMIT 1
    ) INTO v_verified;
  END IF;

  INSERT INTO public.profiles (id, full_name, email, whatsapp, whatsapp_verified)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    NULLIF(v_phone, ''),
    v_verified
  );
  RETURN NEW;
END;
$function$;