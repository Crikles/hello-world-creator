CREATE OR REPLACE FUNCTION public.generate_tracking_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
  provider TEXT;
  suffix TEXT;
BEGIN
  IF NEW.loja_id IS NOT NULL THEN
    SELECT logistica_provider INTO provider FROM lojas WHERE id = NEW.loja_id;
  END IF;

  suffix := CASE
    WHEN provider = 'jadlog' THEN 'JD'
    WHEN provider = 'vetor' THEN 'VT'
    WHEN provider = 'atlas' THEN 'AT'
    ELSE 'JL'
  END;

  IF NEW.codigo_rastreio IS NULL OR NEW.codigo_rastreio = '' THEN
    LOOP
      new_code := 'BR' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10)) || suffix;
      SELECT EXISTS(SELECT 1 FROM envios WHERE codigo_rastreio = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    NEW.codigo_rastreio := new_code;
  END IF;

  IF NEW.transportadora IS NULL OR NEW.transportadora = '' THEN
    NEW.transportadora := CASE
      WHEN provider = 'jadlog' THEN 'JADLOG Logística'
      WHEN provider = 'vetor' THEN 'VETOR Transportes'
      WHEN provider = 'atlas' THEN 'ATLAS Transportes'
      ELSE 'JL RASTREIOS'
    END;
  END IF;

  RETURN NEW;
END;
$function$;