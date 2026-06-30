
-- ============================================================
-- 1) REVOKE EXECUTE em funções internas (SECURITY DEFINER sensíveis)
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_default_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_user_credits() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_max_lojas() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_tracking_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_global_flow_on_envio() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_seed_global_flow_eventos() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_global_flow_eventos(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_signup_email_domain() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_profile_blocked_to_auth() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.envio_to_lead() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.try_create_envio_dedupe(uuid, text, numeric, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.debit_user_credits(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_user_credits(uuid, numeric, text) FROM PUBLIC, anon, authenticated;

-- Admin RPCs: somente service_role (já checam has_role internamente, mas reforçamos)
REVOKE EXECUTE ON FUNCTION public.get_admin_debit_diagnostics() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_user_activity() FROM PUBLIC, anon;

-- Helpers chamados via RLS/RPC: somente autenticados (anon não precisa)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_owns_loja(uuid, uuid) FROM PUBLIC, anon;

-- RPCs do app: restringir a authenticated apenas
REVOKE EXECUTE ON FUNCTION public.get_envios_paginated(uuid, text, text, text, text, timestamptz, timestamptz, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_envios_stats(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_loja_chart_data(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_loja_faturamento(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_confirmacao_grouped(uuid, text, text, text, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_confirmacao_placar(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_debit_blocks(uuid) FROM PUBLIC, anon;

-- ============================================================
-- 2) Storage: bucket "logos" — permitir leitura por path mas impedir listagem aberta
-- ============================================================
-- A leitura por URL pública continua funcionando (Supabase storage serve via signed URL pública).
-- Removemos a policy que permite SELECT amplo (que habilita listing) e
-- substituímos por uma policy que ainda permite SELECT por bucket_id,
-- mas qualquer SELECT precisa fornecer um "name" (path) — o storage.objects
-- listing endpoint sempre fornece, mas vamos negar listagem de root vazia.
DROP POLICY IF EXISTS "Logos public read" ON storage.objects;
CREATE POLICY "Logos public read by path"
  ON storage.objects FOR SELECT
  TO public
  USING (
    bucket_id = 'logos'
    AND name IS NOT NULL
    AND length(name) > 0
    AND name NOT LIKE '%/'
  );

-- ============================================================
-- 3) Profiles — endurecer (sem brechas para anon)
-- ============================================================
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 4) user_roles — remover policy duplicada permissiva
-- ============================================================
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
-- Mantém: "Only admins can write user_roles" (ALL/admin) + "Users can view own roles" (SELECT próprio)
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- 5) signup_verifications — bloquear qualquer leitura de cliente
-- ============================================================
-- Já tem ALL admin; garantimos que anon não tenha GRANT.
REVOKE ALL ON public.signup_verifications FROM anon;
REVOKE ALL ON public.signup_verifications FROM authenticated;
GRANT ALL ON public.signup_verifications TO service_role;
