
-- whatsapp_send_queue
CREATE TABLE IF NOT EXISTS public.whatsapp_send_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL,
  envio_id UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_send_queue TO authenticated;
GRANT ALL ON public.whatsapp_send_queue TO service_role;
ALTER TABLE public.whatsapp_send_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own loja whatsapp_queue" ON public.whatsapp_send_queue
  FOR ALL USING (user_owns_loja(auth.uid(), loja_id)) WITH CHECK (user_owns_loja(auth.uid(), loja_id));
CREATE INDEX IF NOT EXISTS idx_wq_loja_status ON public.whatsapp_send_queue(loja_id, status, scheduled_at);

-- cashback_log
CREATE TABLE IF NOT EXISTS public.cashback_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  envio_id UUID,
  loja_id UUID,
  valor NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cashback_log TO authenticated;
GRANT ALL ON public.cashback_log TO service_role;
ALTER TABLE public.cashback_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage cashback_log" ON public.cashback_log
  FOR ALL USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Users view own cashback_log" ON public.cashback_log
  FOR SELECT USING (auth.uid() = user_id);

-- whatsapp_instances extras
ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS instance_name TEXT,
  ADD COLUMN IF NOT EXISTS qr_code TEXT,
  ADD COLUMN IF NOT EXISTS pairing_code TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- whatsapp_message_log extras
ALTER TABLE public.whatsapp_message_log
  ADD COLUMN IF NOT EXISTS envio_id UUID,
  ADD COLUMN IF NOT EXISTS instance_id UUID,
  ADD COLUMN IF NOT EXISTS error_reason TEXT;

-- postagem_config WhatsApp extras
ALTER TABLE public.postagem_config
  ADD COLUMN IF NOT EXISTS whatsapp_msg_template TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_btn_text TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_footer TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_auto_send BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_delay_seconds INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS whatsapp_image_url TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_reply_text TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_btn2_text TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_btn2_url TEXT;

-- postagem_email_log extras
ALTER TABLE public.postagem_email_log
  ADD COLUMN IF NOT EXISTS custo NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assunto TEXT,
  ADD COLUMN IF NOT EXISTS evento_id UUID,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- default whatsapp cost
INSERT INTO public.system_config(key,value) VALUES ('custo_whatsapp', 0.10)
ON CONFLICT (key) DO NOTHING;
