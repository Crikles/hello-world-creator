
-- Drop the old expression-based unique index that PostgREST cannot use as ON CONFLICT target
DROP INDEX IF EXISTS public.live_view_pings_session_codigo_uniq;

-- Backfill: ensure no duplicates exist before adding the new unique constraint
DELETE FROM public.live_view_pings a
USING public.live_view_pings b
WHERE a.ctid < b.ctid
  AND a.loja_id = b.loja_id
  AND a.session_id = b.session_id
  AND a.codigo_rastreio IS NOT DISTINCT FROM b.codigo_rastreio;

-- New unique index matching the upsert onConflict target in edge function rastreio-info
CREATE UNIQUE INDEX live_view_pings_loja_session_codigo_uniq
  ON public.live_view_pings (loja_id, session_id, codigo_rastreio);
