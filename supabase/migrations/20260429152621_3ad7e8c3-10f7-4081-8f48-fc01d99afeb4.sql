-- ── A.1: Descongela envios da loja yaveh que estão com template diferente do ativo ──
UPDATE public.envios e
SET postagem_template_id = NULL
FROM public.postagem_config pc
WHERE e.loja_id = '428f4bb4-5b53-4d34-a9a1-a139e7cceaaf'
  AND pc.loja_id = e.loja_id
  AND e.deleted_at IS NULL
  AND e.status <> 'entregue'
  AND e.postagem_template_id IS NOT NULL
  AND e.postagem_template_id <> pc.template_ativo_id;

-- ── D: Limpeza global de templates duplicados ──
-- Para cada (loja_id, tipo) com >1 cópia não-system, mantém apenas a referenciada
-- pelo postagem_config.template_ativo_id (ou a mais recente como fallback).
WITH active_per_loja AS (
  SELECT loja_id, template_ativo_id FROM public.postagem_config
),
copies AS (
  SELECT
    pt.id, pt.loja_id, pt.tipo, pt.created_at,
    a.template_ativo_id AS active_id,
    ROW_NUMBER() OVER (
      PARTITION BY pt.loja_id, pt.tipo
      ORDER BY
        (pt.id = a.template_ativo_id) DESC NULLS LAST,
        pt.created_at DESC
    ) AS rn,
    COUNT(*) OVER (PARTITION BY pt.loja_id, pt.tipo) AS total
  FROM public.postagem_templates pt
  LEFT JOIN active_per_loja a ON a.loja_id = pt.loja_id
  WHERE pt.is_system = false
    AND pt.loja_id IS NOT NULL
),
to_delete AS (
  SELECT id FROM copies WHERE total > 1 AND rn > 1
),
-- Antes de deletar, nullificar referências em envios para esses templates
nullify AS (
  UPDATE public.envios
  SET postagem_template_id = NULL
  WHERE postagem_template_id IN (SELECT id FROM to_delete)
  RETURNING 1
),
-- Deletar eventos órfãos
del_evts AS (
  DELETE FROM public.postagem_eventos
  WHERE template_id IN (SELECT id FROM to_delete)
  RETURNING 1
)
DELETE FROM public.postagem_templates
WHERE id IN (SELECT id FROM to_delete);