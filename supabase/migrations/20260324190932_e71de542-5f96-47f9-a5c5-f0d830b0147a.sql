CREATE TABLE public.whatsapp_send_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  envio_id uuid NOT NULL REFERENCES envios(id) ON DELETE CASCADE,
  instance_id uuid REFERENCES whatsapp_instances(id) ON DELETE SET NULL,
  number text NOT NULL,
  msg_text text NOT NULL,
  choices jsonb DEFAULT '[]'::jsonb,
  image_url text,
  footer_text text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE public.whatsapp_send_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own loja whatsapp_send_queue"
  ON public.whatsapp_send_queue
  FOR ALL
  TO authenticated
  USING (user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (user_owns_loja(auth.uid(), loja_id));

CREATE INDEX idx_whatsapp_queue_pending ON public.whatsapp_send_queue (status, scheduled_at) WHERE status = 'pending';