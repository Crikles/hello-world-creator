
-- 1) postagem_eventos
DROP POLICY IF EXISTS "Users read system or own postagem_eventos" ON public.postagem_eventos;
CREATE POLICY "Authenticated read system or own postagem_eventos"
  ON public.postagem_eventos FOR SELECT
  TO authenticated
  USING (loja_id IS NULL OR public.user_owns_loja(auth.uid(), loja_id));
REVOKE SELECT ON public.postagem_eventos FROM anon;

-- 2) push_templates
DROP POLICY IF EXISTS "Authenticated read push_templates" ON public.push_templates;
CREATE POLICY "Authenticated read push_templates"
  ON public.push_templates FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.push_templates FROM anon;

-- 3) sms_templates
DROP POLICY IF EXISTS "Authenticated read sms_templates" ON public.sms_templates;
CREATE POLICY "Authenticated read sms_templates"
  ON public.sms_templates FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.sms_templates FROM anon;

-- 4) user_roles: bloquear writes de não-admin
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon, authenticated;

DROP POLICY IF EXISTS "Only admins can write user_roles" ON public.user_roles;
CREATE POLICY "Only admins can write user_roles"
  ON public.user_roles
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
