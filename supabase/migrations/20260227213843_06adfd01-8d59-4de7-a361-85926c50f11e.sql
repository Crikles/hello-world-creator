CREATE POLICY "Admins can view all pix_payments"
ON public.pix_payments FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));