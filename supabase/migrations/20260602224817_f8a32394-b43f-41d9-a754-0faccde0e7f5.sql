-- 1. Server-side email domain whitelist (BEFORE INSERT trigger on auth.users)
CREATE OR REPLACE FUNCTION public.validate_signup_email_domain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_domain text;
  v_allowed text[] := ARRAY['gmail.com','hotmail.com','outlook.com','proton.me'];
BEGIN
  v_domain := lower(split_part(NEW.email, '@', 2));
  IF v_domain IS NULL OR v_domain = '' OR NOT (v_domain = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Apenas emails Gmail, Hotmail, Outlook ou Proton são permitidos'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_email_domain_trigger ON auth.users;
CREATE TRIGGER validate_email_domain_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_signup_email_domain();

-- 2. Auto-sync profile.blocked -> auth.users.banned_until (revoga tokens existentes)
CREATE OR REPLACE FUNCTION public.sync_profile_blocked_to_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.blocked IS DISTINCT FROM OLD.blocked THEN
    IF NEW.blocked = true THEN
      UPDATE auth.users
        SET banned_until = 'infinity'::timestamptz
        WHERE id = NEW.id;
    ELSE
      UPDATE auth.users
        SET banned_until = NULL
        WHERE id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_blocked_trigger ON public.profiles;
CREATE TRIGGER sync_blocked_trigger
  AFTER UPDATE OF blocked ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_blocked_to_auth();

-- Sincroniza usuários já bloqueados agora
UPDATE auth.users u
  SET banned_until = 'infinity'::timestamptz
  FROM public.profiles p
  WHERE p.id = u.id AND p.blocked = true AND u.banned_until IS NULL;