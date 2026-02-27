
-- 1. push_subscriptions
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  codigo_rastreio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public insert push_subscriptions"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public select push_subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (true);

-- 2. push_notification_settings
CREATE TABLE public.push_notification_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  icon_url TEXT DEFAULT '/favicon.ico',
  badge_url TEXT DEFAULT '/favicon.ico',
  default_url TEXT DEFAULT '/',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.push_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public select push_notification_settings"
  ON public.push_notification_settings FOR SELECT
  USING (true);

CREATE POLICY "Public insert push_notification_settings"
  ON public.push_notification_settings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public update push_notification_settings"
  ON public.push_notification_settings FOR UPDATE
  USING (true);

-- Insert default row
INSERT INTO public.push_notification_settings (icon_url, badge_url, default_url)
VALUES ('/favicon.ico', '/favicon.ico', '/');

-- 3. push_notification_log
CREATE TABLE public.push_notification_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT,
  icon_url TEXT,
  total_sent INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.push_notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public select push_notification_log"
  ON public.push_notification_log FOR SELECT
  USING (true);

CREATE POLICY "Public insert push_notification_log"
  ON public.push_notification_log FOR INSERT
  WITH CHECK (true);
