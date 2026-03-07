-- WhatsApp instances table (one per loja)
CREATE TABLE IF NOT EXISTS public.whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  instance_name text NOT NULL,
  instance_token text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected',
  qr_code text,
  pairing_code text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_instances_loja_id_key UNIQUE (loja_id)
);

-- Add WhatsApp message template columns to postagem_config
ALTER TABLE public.postagem_config
  ADD COLUMN IF NOT EXISTS whatsapp_msg_template text DEFAULT 'Olá {{nome}}! 👋

Seu pedido *{{produto}}* no valor de *R$ {{valor}}* foi despachado!

📦 Código de Rastreio: *{{codigo_rastreio}}*

Clique no botão abaixo para acompanhar a entrega em tempo real:',
  ADD COLUMN IF NOT EXISTS whatsapp_btn_text text DEFAULT '📦 Rastrear Pedido',
  ADD COLUMN IF NOT EXISTS whatsapp_footer text DEFAULT 'Obrigado pela sua compra!';

-- RLS
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own whatsapp instances"
  ON public.whatsapp_instances FOR SELECT
  USING (
    loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert their own whatsapp instances"
  ON public.whatsapp_instances FOR INSERT
  WITH CHECK (
    loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update their own whatsapp instances"
  ON public.whatsapp_instances FOR UPDATE
  USING (
    loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete their own whatsapp instances"
  ON public.whatsapp_instances FOR DELETE
  USING (
    loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid())
  );
