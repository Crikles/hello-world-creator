
-- Allow admins to view all whatsapp instances
CREATE POLICY "Admins full access whatsapp_instances"
ON public.whatsapp_instances
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));
