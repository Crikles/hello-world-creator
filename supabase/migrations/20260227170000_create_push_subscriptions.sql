-- ═══════════════════════════════════════════════════════════
-- Push Subscriptions table for Web Push notifications
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL UNIQUE,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  codigo_rastreio TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (public tracking page visitors)
CREATE POLICY "Allow anonymous inserts" ON public.push_subscriptions
  FOR INSERT WITH CHECK (true);

-- Allow reads for service role (edge functions)
CREATE POLICY "Allow service role reads" ON public.push_subscriptions
  FOR SELECT USING (true);


-- ═══════════════════════════════════════════════════════════
-- Push notification settings (admin-managed)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.push_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  icon_url TEXT DEFAULT '/favicon.ico',
  badge_url TEXT DEFAULT '/favicon.ico',
  default_url TEXT DEFAULT '/',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.push_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated reads" ON public.push_notification_settings
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated updates" ON public.push_notification_settings
  FOR UPDATE USING (true);

CREATE POLICY "Allow authenticated inserts" ON public.push_notification_settings
  FOR INSERT WITH CHECK (true);

-- Seed with default values
INSERT INTO public.push_notification_settings (icon_url, badge_url, default_url)
VALUES ('/favicon.ico', '/favicon.ico', '/')
ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════
-- Push notification log (history of sent notifications)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.push_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT,
  icon_url TEXT,
  total_sent INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.push_notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated reads on log" ON public.push_notification_log
  FOR SELECT USING (true);

CREATE POLICY "Allow inserts on log" ON public.push_notification_log
  FOR INSERT WITH CHECK (true);
