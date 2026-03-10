

# Bug: Webhooks criam envios sem transportadora e sem sufixo correto

## Causa raiz

Quando um pedido entra via **webhook** (Shopify, Vega, Zedy, Luna, Corvex), o envio é inserido **sem** `transportadora` e **sem** `codigo_rastreio`. O trigger de banco `generate_tracking_code()` gera o código como `BR` + 10 chars aleatórios — **sem o sufixo `JD` ou `JL`** e sem preencher `transportadora`.

Já no frontend (NovoEnvioWizard e ImportarPlanilha), o código é gerado manualmente com o sufixo correto e a transportadora é definida. Mas os webhooks não fazem isso.

**Resultado**: envios via webhook ficam com `transportadora = null` e código sem sufixo, quebrando a lógica de identificação da transportadora.

## Solução

Atualizar o trigger `generate_tracking_code()` para:
1. Consultar `lojas.logistica_provider` usando `NEW.loja_id`
2. Definir o sufixo (`JD` para jadlog, `JL` para os demais)
3. Preencher `NEW.transportadora` automaticamente se estiver null

### Migration SQL

```sql
CREATE OR REPLACE FUNCTION public.generate_tracking_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
  provider TEXT;
  suffix TEXT;
BEGIN
  -- Determine provider from loja
  IF NEW.loja_id IS NOT NULL THEN
    SELECT logistica_provider INTO provider
    FROM lojas WHERE id = NEW.loja_id;
  END IF;

  suffix := CASE WHEN provider = 'jadlog' THEN 'JD' ELSE 'JL' END;

  -- Generate tracking code with correct suffix
  IF NEW.codigo_rastreio IS NULL OR NEW.codigo_rastreio = '' THEN
    LOOP
      new_code := 'BR' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10)) || suffix;
      SELECT EXISTS(SELECT 1 FROM envios WHERE codigo_rastreio = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    NEW.codigo_rastreio := new_code;
  END IF;

  -- Set transportadora if not provided
  IF NEW.transportadora IS NULL OR NEW.transportadora = '' THEN
    NEW.transportadora := CASE WHEN provider = 'jadlog' 
      THEN 'JADLOG Logística' 
      ELSE 'JL RASTREIOS' 
    END;
  END IF;

  RETURN NEW;
END;
$$;
```

### Frontend cleanup

Remover a geração manual de `codigo_rastreio` e `transportadora` de:
- `NovoEnvioWizard.tsx` — deixar o trigger gerar automaticamente
- `ImportarPlanilha.tsx` — idem

Isso centraliza a lógica em um único lugar (trigger) e garante consistência entre webhooks e criação manual.

