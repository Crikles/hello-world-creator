CREATE POLICY "Admins can manage system template eventos"
ON public.postagem_eventos
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));