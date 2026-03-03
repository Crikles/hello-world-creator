-- Evolution of the system: Giving admins "Total Control"
-- This allows admins to perform any action on any table, which is necessary for the Impersonation feature.

-- 1. Update user_owns_loja helper to return true for admins
-- This automatically enables access to: empresas, envios, pedidos, postagem_templates, postagem_eventos, postagem_config, postagem_email_log, shopify_integrations, checkout_integrations, etc.
CREATE OR REPLACE FUNCTION public.user_owns_loja(_user_id UUID, _loja_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lojas
    WHERE id = _loja_id AND user_id = _user_id
  ) OR public.has_role(_user_id, 'admin');
$$;

-- 2. Grant full access to admins on 'profiles'
-- Dropping old select-only policy if it exists to avoid redundancy (though not strictly necessary as they are additive)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins full access profiles" ON public.profiles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Grant full access to admins on 'lojas'
DROP POLICY IF EXISTS "Admins can view all lojas" ON public.lojas;
CREATE POLICY "Admins full access lojas" ON public.lojas
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
