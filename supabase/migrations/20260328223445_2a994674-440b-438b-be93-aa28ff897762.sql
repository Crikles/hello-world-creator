
CREATE TABLE public.admin_payment_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  label text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_payment_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access admin_payment_webhooks"
  ON public.admin_payment_webhooks
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access admin_payment_webhooks"
  ON public.admin_payment_webhooks
  FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

INSERT INTO public.admin_payment_webhooks (url, label) VALUES
  ('https://api.pushcut.io/cnofVRbcHtpDYX8uuBjpi/notifications/Recarga%20Magnus', 'PushCut Magnus'),
  ('https://api.pushcut.io/nvQPVRoZkrDRY_bb1oBXq/notifications/MinhaNotifica%C3%A7%C3%A3o1', 'PushCut Notificação');
