
-- Create whatsapp_subscriptions table
CREATE TABLE public.whatsapp_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  price_paid NUMERIC NOT NULL DEFAULT 29.99,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add subscription_id to whatsapp_instances
ALTER TABLE public.whatsapp_instances
  ADD COLUMN subscription_id UUID REFERENCES public.whatsapp_subscriptions(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.whatsapp_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS: users can access their own loja subscriptions
CREATE POLICY "Users access own loja whatsapp_subscriptions"
  ON public.whatsapp_subscriptions
  FOR ALL
  USING (user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (user_owns_loja(auth.uid(), loja_id));

-- RLS: admins full access
CREATE POLICY "Admins full access whatsapp_subscriptions"
  ON public.whatsapp_subscriptions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
