-- Deduplicate existing pings: keep the oldest row per (loja, session, codigo), delete the rest
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY loja_id, session_id, codigo_rastreio
           ORDER BY created_at ASC
         ) AS rn
  FROM public.live_view_pings
)
DELETE FROM public.live_view_pings
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Prevent future duplicates and enable safe upserts
CREATE UNIQUE INDEX IF NOT EXISTS live_view_pings_unique_session_codigo
  ON public.live_view_pings (loja_id, session_id, codigo_rastreio);