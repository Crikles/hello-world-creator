
CREATE TABLE public.shopify_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE UNIQUE,
    shop_url TEXT NOT NULL,
    client_id TEXT NOT NULL,
    client_secret TEXT NOT NULL,
    access_token TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shopify_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own loja shopify_integrations"
ON public.shopify_integrations
FOR ALL
USING (user_owns_loja(auth.uid(), loja_id))
WITH CHECK (user_owns_loja(auth.uid(), loja_id));

CREATE POLICY "Service role full access shopify_integrations"
ON public.shopify_integrations
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER update_shopify_integrations_updated_at
BEFORE UPDATE ON public.shopify_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_shopify_integrations_loja_id ON public.shopify_integrations(loja_id);
