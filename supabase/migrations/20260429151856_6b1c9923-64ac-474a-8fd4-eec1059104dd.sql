UPDATE public.envios
SET ultimo_evento_ordem = 1,
    status = 'em_transito',
    status_label = 'Postado',
    proximo_avanco_em = created_at + interval '24 hours',
    updated_at = now()
WHERE loja_id = '428f4bb4-5b53-4d34-a9a1-a139e7cceaaf'
  AND created_at >= '2026-04-29 00:00:00+00'
  AND deleted_at IS NULL
  AND ultimo_evento_ordem >= 2
  AND (updated_at - created_at) < interval '2 hours';