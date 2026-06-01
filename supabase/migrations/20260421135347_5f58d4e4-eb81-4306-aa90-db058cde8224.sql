-- Remover duplicatas mantendo o lead mais antigo por (loja_id, orderId)
DELETE FROM public.recovery_leads
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY loja_id, (raw_payload->>'orderId')
      ORDER BY created_at ASC
    ) AS rn
    FROM public.recovery_leads
    WHERE raw_payload->>'orderId' IS NOT NULL
  ) t WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS recovery_leads_loja_orderid_unique
ON public.recovery_leads (loja_id, ((raw_payload->>'orderId')))
WHERE raw_payload->>'orderId' IS NOT NULL;