-- Tighten RLS on live_view_pings: writes only via service_role edge function (rastreio-info)
DROP POLICY IF EXISTS "Public insert live_view_pings" ON public.live_view_pings;
DROP POLICY IF EXISTS "Public update live_view_pings" ON public.live_view_pings;

-- Revoke anon write privileges (service_role keeps full access)
REVOKE INSERT, UPDATE ON public.live_view_pings FROM anon;
REVOKE INSERT, UPDATE ON public.live_view_pings FROM authenticated;