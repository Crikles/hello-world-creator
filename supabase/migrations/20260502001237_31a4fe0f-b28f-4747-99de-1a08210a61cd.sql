-- Backfill: remove envios "saiu_para_entrega" da fila do cron.
-- O próximo evento natural seria "Entregue" (manual), portanto não há nada a avançar.
UPDATE public.envios
SET proximo_avanco_em = NULL
WHERE deleted_at IS NULL
  AND status = 'saiu_para_entrega'
  AND proximo_avanco_em IS NOT NULL;