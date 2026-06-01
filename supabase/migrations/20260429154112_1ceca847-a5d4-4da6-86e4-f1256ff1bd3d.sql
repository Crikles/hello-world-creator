UPDATE envios
SET ultimo_evento_ordem = 0,
    status = 'pendente'::shipment_status,
    status_label = NULL,
    proximo_avanco_em = NULL,
    updated_at = now()
WHERE id IN (
  SELECT e.id FROM envios e
  JOIN lojas l ON l.id = e.loja_id
  JOIN profiles p ON p.id = l.user_id
  WHERE p.email = 'backupativado@gmail.com'
    AND e.ultimo_evento_ordem = 1
    AND e.updated_at > '2026-04-29 15:25:30'
    AND e.deleted_at IS NULL
);