CREATE TABLE public.live_view_pings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id uuid NOT NULL,
  session_id text NOT NULL,
  codigo_rastreio text,
  cidade text,
  estado text,
  pais text,
  pais_codigo text,
  lat numeric,
  lng numeric,
  user_agent text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX live_view_pings_session_codigo_uniq
  ON public.live_view_pings (session_id, COALESCE(codigo_rastreio, ''));

CREATE INDEX live_view_pings_loja_lastseen_idx
  ON public.live_view_pings (loja_id, last_seen_at DESC);

ALTER TABLE public.live_view_pings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manage live_view_pings"
  ON public.live_view_pings
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users view own loja live_view_pings"
  ON public.live_view_pings
  FOR SELECT
  USING (public.user_owns_loja(auth.uid(), loja_id));

ALTER TABLE public.live_view_pings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_view_pings;