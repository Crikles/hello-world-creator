
-- 1. Create whatsapp_message_log table
CREATE TABLE public.whatsapp_message_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  envio_id UUID REFERENCES public.envios(id) ON DELETE CASCADE NOT NULL,
  loja_id UUID REFERENCES public.lojas(id) ON DELETE CASCADE NOT NULL,
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_message_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own loja whatsapp_message_log"
  ON public.whatsapp_message_log FOR ALL TO authenticated
  USING (user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (user_owns_loja(auth.uid(), loja_id));

-- 2. Add auto-send columns to postagem_config
ALTER TABLE public.postagem_config
  ADD COLUMN IF NOT EXISTS whatsapp_auto_send BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_delay_seconds INTEGER DEFAULT 300;

-- 3. Remove unique constraint on whatsapp_instances(loja_id) to allow multiple instances
ALTER TABLE public.whatsapp_instances DROP CONSTRAINT IF EXISTS whatsapp_instances_loja_id_key;
