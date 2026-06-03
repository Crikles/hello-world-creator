## Análise

Verifiquei os usos no frontend:
- `postagem_eventos`, `push_templates`, `sms_templates` são lidos apenas em páginas autenticadas (admin, lojista). Nenhum uso na página pública `Rastreio`.
- `user_roles` é lido por `useIsAdmin` e `AdminUsuarios`, e escrito apenas pela trigger `assign_default_role` (SECURITY DEFINER) e por admins.

Restringir ao papel `authenticated` não quebra nada.

## Migration única

```sql
-- 1) postagem_eventos: SELECT só para authenticated
DROP POLICY IF EXISTS "Users read system or own postagem_eventos" ON public.postagem_eventos;
CREATE POLICY "Authenticated read system or own postagem_eventos"
  ON public.postagem_eventos FOR SELECT
  TO authenticated
  USING (loja_id IS NULL OR public.user_owns_loja(auth.uid(), loja_id));
REVOKE SELECT ON public.postagem_eventos FROM anon;

-- 2) push_templates: SELECT só para authenticated
DROP POLICY IF EXISTS "Authenticated read push_templates" ON public.push_templates;
CREATE POLICY "Authenticated read push_templates"
  ON public.push_templates FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.push_templates FROM anon;

-- 3) sms_templates: SELECT só para authenticated
DROP POLICY IF EXISTS "Authenticated read sms_templates" ON public.sms_templates;
CREATE POLICY "Authenticated read sms_templates"
  ON public.sms_templates FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.sms_templates FROM anon;

-- 4) user_roles: bloquear writes de não-admin com RESTRICTIVE policy + revogar grants
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon, authenticated;

CREATE POLICY "Only admins can write user_roles"
  ON public.user_roles
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
```

A trigger `assign_default_role` é SECURITY DEFINER → continua inserindo o papel `user` no signup sem precisar de grant para o usuário. `has_role` também é SECURITY DEFINER → leitura do próprio role continua funcionando para o check de admin.

Nenhuma mudança em código de aplicação.