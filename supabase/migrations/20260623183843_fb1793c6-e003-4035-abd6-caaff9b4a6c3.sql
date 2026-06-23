
-- 1) global_flow_system_templates: leitura só para autenticados (remover anon)
DROP POLICY IF EXISTS "read system global templates" ON public.global_flow_system_templates;
CREATE POLICY "read system global templates"
  ON public.global_flow_system_templates
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE SELECT ON public.global_flow_system_templates FROM anon;

-- 2) webhook_logs: leitura para dono da loja; escritas só pelo service_role
DROP POLICY IF EXISTS "Users access own loja webhook_logs" ON public.webhook_logs;

CREATE POLICY "Loja owners read own webhook_logs"
  ON public.webhook_logs
  FOR SELECT
  TO authenticated
  USING (public.user_owns_loja(auth.uid(), loja_id));

-- Garantir que apenas service_role consegue escrever (revogar grants amplos)
REVOKE INSERT, UPDATE, DELETE ON public.webhook_logs FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.webhook_logs FROM anon;
GRANT SELECT ON public.webhook_logs TO authenticated;
GRANT ALL ON public.webhook_logs TO service_role;
