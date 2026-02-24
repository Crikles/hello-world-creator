CREATE POLICY "Admins can view all email logs"
ON public.postagem_email_log
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));