
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS marca text;
CREATE INDEX IF NOT EXISTS idx_envios_marca ON public.envios(marca);

CREATE OR REPLACE FUNCTION public.generate_tracking_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
  provider TEXT;
  v_lang TEXT;
  v_marca TEXT;
  v_prefix TEXT;
  v_suffix TEXT;
  v_transportadora TEXT;
BEGIN
  IF NEW.loja_id IS NOT NULL THEN
    SELECT logistica_provider INTO provider FROM lojas WHERE id = NEW.loja_id;
  END IF;
  provider := lower(coalesce(provider, 'atlas'));
  v_lang := lower(coalesce(NEW.global_flow_lang, ''));

  -- Decide marca
  IF COALESCE(NEW.is_international, false) THEN
    IF v_lang = 'es' THEN
      v_marca := 'trackmaster_es';
    ELSE
      v_marca := 'trackmaster_us';
    END IF;
  ELSE
    IF provider = 'jetline' THEN
      v_marca := 'jetline';
    ELSE
      v_marca := 'atlas';
    END IF;
  END IF;

  -- Override se já vier setado
  IF NEW.marca IS NOT NULL AND NEW.marca <> '' THEN
    v_marca := NEW.marca;
  END IF;
  NEW.marca := v_marca;

  -- Mapear prefixo / sufixo / transportadora
  IF v_marca = 'trackmaster_us' THEN
    v_prefix := 'TM'; v_suffix := 'US'; v_transportadora := 'TrackMaster Global Logistics';
  ELSIF v_marca = 'trackmaster_es' THEN
    v_prefix := 'TM'; v_suffix := 'ES'; v_transportadora := 'TrackMaster Logística Global';
  ELSIF v_marca = 'jetline' THEN
    v_prefix := 'BR'; v_suffix := 'JL'; v_transportadora := 'JETLINE Logística';
  ELSE
    v_prefix := 'BR'; v_suffix := 'AT'; v_transportadora := 'ATLAS Transportes';
  END IF;

  IF NEW.codigo_rastreio IS NULL OR NEW.codigo_rastreio = '' THEN
    LOOP
      new_code := v_prefix || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10)) || v_suffix;
      SELECT EXISTS(SELECT 1 FROM envios WHERE codigo_rastreio = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    NEW.codigo_rastreio := new_code;
  ELSE
    NEW.codigo_rastreio := upper(NEW.codigo_rastreio);
  END IF;

  IF NEW.transportadora IS NULL OR NEW.transportadora = '' THEN
    NEW.transportadora := v_transportadora;
  END IF;

  RETURN NEW;
END;
$function$;

-- Backfill marca em envios existentes (sem mexer no codigo_rastreio)
UPDATE public.envios SET marca = CASE
  WHEN is_international = true AND lower(coalesce(global_flow_lang,'')) = 'es' THEN 'trackmaster_es'
  WHEN is_international = true THEN 'trackmaster_us'
  WHEN codigo_rastreio ILIKE '%JL' THEN 'jetline'
  ELSE 'atlas'
END
WHERE marca IS NULL;
