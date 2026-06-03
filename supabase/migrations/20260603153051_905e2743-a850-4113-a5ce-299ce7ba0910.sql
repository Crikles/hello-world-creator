-- system_config: restrict read to authenticated
DROP POLICY IF EXISTS "Public read system_config" ON public.system_config;
CREATE POLICY "Authenticated read system_config"
  ON public.system_config FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.system_config FROM anon;
GRANT SELECT ON public.system_config TO authenticated;

-- push_subscriptions: allow users to read/delete their own
CREATE POLICY "Users view own push_subs"
  ON public.push_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own push_subs"
  ON public.push_subscriptions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, DELETE ON public.push_subscriptions TO authenticated;