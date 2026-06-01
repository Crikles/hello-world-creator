-- ============================================================
-- PARTE 0: Corrigir constraint que impedia tipo='estorno'
-- ============================================================
ALTER TABLE creditos_transacoes DROP CONSTRAINT IF EXISTS creditos_transacoes_tipo_check;
ALTER TABLE creditos_transacoes ADD CONSTRAINT creditos_transacoes_tipo_check
  CHECK (tipo = ANY (ARRAY['adicao'::text, 'consumo'::text, 'estorno'::text, 'cashback'::text]));

-- ============================================================
-- PARTE 1: Estornar créditos cobrados em duplicidade
-- ============================================================
DO $$
DECLARE
  rec RECORD;
  v_total numeric;
BEGIN
  FOR rec IN
    WITH dups AS (
      SELECT envio_id, evento_id, destinatario, loja_id
      FROM postagem_email_log
      WHERE envio_id IS NOT NULL AND evento_id IS NOT NULL AND destinatario IS NOT NULL
      GROUP BY envio_id, evento_id, destinatario, loja_id
      HAVING COUNT(*) > 1
    ),
    per_user AS (
      SELECT lo.user_id, COUNT(DISTINCT d.envio_id) AS envios_duplicados
      FROM dups d
      JOIN lojas lo ON lo.id = d.loja_id
      GROUP BY lo.user_id
    )
    SELECT
      pu.user_id,
      pu.envios_duplicados,
      COALESCE((
        SELECT MAX(
          (CASE WHEN pc.enviar_nfe_email THEN COALESCE((p.custom_prices->>'custo_nfe_email')::numeric, 0.5) ELSE 0 END) +
          (CASE WHEN pc.enviar_emails THEN COALESCE((p.custom_prices->>'custo_email_rastreio')::numeric, 1.0) ELSE 0 END) +
          (CASE WHEN pc.ativar_taxacao THEN COALESCE((p.custom_prices->>'custo_taxacao')::numeric, 0) ELSE 0 END) +
          (CASE WHEN pc.ativar_falha_entrega THEN COALESCE((p.custom_prices->>'custo_falha_entrega')::numeric, 0) ELSE 0 END)
        )
        FROM lojas lo2
        JOIN postagem_config pc ON pc.loja_id = lo2.id
        LEFT JOIN profiles p ON p.id = lo2.user_id
        WHERE lo2.user_id = pu.user_id
      ), 1.5) AS custo_por_envio
    FROM per_user pu
  LOOP
    v_total := rec.envios_duplicados * rec.custo_por_envio;
    IF v_total > 0 THEN
      PERFORM public.refund_user_credits(
        rec.user_id,
        v_total,
        'Estorno automático: ' || rec.envios_duplicados || ' envio(s) cobrados em duplicidade (race condition email-trigger / advance-shipments)'
      );
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- PARTE 2: Deduplicar postagem_email_log (mantém o mais antigo)
-- ============================================================
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY envio_id, evento_id, destinatario, loja_id
      ORDER BY created_at ASC
    ) AS rn
  FROM postagem_email_log
  WHERE envio_id IS NOT NULL AND evento_id IS NOT NULL AND destinatario IS NOT NULL
)
DELETE FROM postagem_email_log
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ============================================================
-- PARTE 3: Índice único parcial para barrar duplicatas futuras
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS uniq_email_log_envio_evento_destinatario
  ON postagem_email_log (envio_id, evento_id, destinatario, loja_id)
  WHERE envio_id IS NOT NULL AND evento_id IS NOT NULL AND destinatario IS NOT NULL;