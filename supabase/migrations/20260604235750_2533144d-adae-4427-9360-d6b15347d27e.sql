
CREATE POLICY "Admins manage all empresas" ON public.empresas FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage all postagem_config" ON public.postagem_config FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage all postagem_templates" ON public.postagem_templates FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage all checkout_integrations" ON public.checkout_integrations FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage all recovery_config" ON public.recovery_config FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage all upsell_config" ON public.upsell_config FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage all pedidos" ON public.pedidos FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Authenticated read system or own postagem_eventos" ON public.postagem_eventos;
CREATE POLICY "Authenticated read system or own postagem_eventos" ON public.postagem_eventos FOR SELECT TO authenticated USING (loja_id IS NULL OR public.user_owns_loja(auth.uid(), loja_id) OR public.has_role(auth.uid(),'admin'));
