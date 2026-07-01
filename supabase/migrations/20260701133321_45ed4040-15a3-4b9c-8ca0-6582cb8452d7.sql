
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS moeda text NOT NULL DEFAULT 'BRL';

-- Backfill a partir do pedido
UPDATE public.envios e
SET moeda = upper(coalesce(p.raw_payload->>'presentment_currency', p.raw_payload->>'currency'))
FROM public.pedidos p
WHERE p.envio_id = e.id
  AND e.moeda = 'BRL'
  AND coalesce(p.raw_payload->>'presentment_currency', p.raw_payload->>'currency') IS NOT NULL;

-- Fallback para envios internacionais sem pedido
UPDATE public.envios
SET moeda = CASE WHEN global_flow_lang = 'es' THEN 'EUR' ELSE 'USD' END
WHERE is_international = true AND moeda = 'BRL';
