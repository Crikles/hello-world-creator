DROP POLICY IF EXISTS "Users view own loja live_view_pings" ON public.live_view_pings;
CREATE POLICY "Users and admins view live_view_pings"
  ON public.live_view_pings FOR SELECT
  USING (
    public.user_owns_loja(auth.uid(), loja_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );