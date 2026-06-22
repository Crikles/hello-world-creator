CREATE OR REPLACE FUNCTION public.apply_global_flow_on_envio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ativo boolean;
  v_idioma text;
BEGIN
  IF NEW.loja_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ativo, idioma INTO v_ativo, v_idioma
  FROM public.global_flow_config
  WHERE loja_id = NEW.loja_id;

  IF COALESCE(v_ativo, false) = true THEN
    NEW.is_international := true;
    IF NEW.global_flow_lang IS NULL OR NEW.global_flow_lang = '' THEN
      NEW.global_flow_lang := COALESCE(v_idioma, 'en');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aa_apply_global_flow_on_envio ON public.envios;
CREATE TRIGGER aa_apply_global_flow_on_envio
  BEFORE INSERT ON public.envios
  FOR EACH ROW EXECUTE FUNCTION public.apply_global_flow_on_envio();