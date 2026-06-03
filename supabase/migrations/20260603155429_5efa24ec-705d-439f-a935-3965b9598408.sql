-- Restringir leitura pública de system_config a chaves não sensíveis
DROP POLICY IF EXISTS "Authenticated read system_config" ON public.system_config;

CREATE POLICY "Authenticated read public system_config keys"
ON public.system_config
FOR SELECT
TO authenticated
USING (
  key LIKE 'custo_%'
  OR key = 'whatsapp_suporte'
);
-- Admins continuam com acesso total via política "Admins manage system_config"