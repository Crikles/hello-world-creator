
CREATE OR REPLACE FUNCTION public.generate_tracking_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
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
      ELSE 'JL RASTREIOS'
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_generate_tracking_code ON public.envios;
CREATE TRIGGER trigger_generate_tracking_code
  BEFORE INSERT ON public.envios
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_tracking_code();

-- Preencher envios já existentes sem código
DO $$
DECLARE
  r RECORD;
  new_code TEXT;
  provider TEXT;
  suffix TEXT;
  code_exists BOOLEAN;
BEGIN
  FOR r IN SELECT id, loja_id FROM envios WHERE codigo_rastreio IS NULL OR codigo_rastreio = '' LOOP
    SELECT logistica_provider INTO provider FROM lojas WHERE id = r.loja_id;
    suffix := CASE WHEN provider = 'jadlog' THEN 'JD' WHEN provider = 'vetor' THEN 'VT' ELSE 'JL' END;
    LOOP
      new_code := 'BR' || upper(substr(md5(random()::text || clock_timestamp()::text || r.id::text), 1, 10)) || suffix;
      SELECT EXISTS(SELECT 1 FROM envios WHERE codigo_rastreio = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    UPDATE envios SET
      codigo_rastreio = new_code,
      transportadora = COALESCE(NULLIF(transportadora,''), CASE WHEN provider='jadlog' THEN 'JADLOG Logística' WHEN provider='vetor' THEN 'VETOR Transportes' ELSE 'JL RASTREIOS' END)
    WHERE id = r.id;
  END LOOP;
END $$;
