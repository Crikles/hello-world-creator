
-- Tabela webhook_logs para auditoria
CREATE TABLE public.webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checkout_provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT,
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Tabela pedidos para armazenar pedidos vindos dos checkouts
CREATE TABLE public.pedidos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checkout_provider TEXT NOT NULL,
  transaction_token TEXT NOT NULL,
  status TEXT NOT NULL,
  method TEXT,
  total_price INTEGER NOT NULL DEFAULT 0,
  customer_name TEXT,
  customer_document TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  address_street TEXT,
  address_number TEXT,
  address_district TEXT,
  address_zip_code TEXT,
  address_city TEXT,
  address_state TEXT,
  address_country TEXT,
  address_complement TEXT,
  products JSONB,
  raw_payload JSONB,
  envio_id UUID REFERENCES public.envios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

-- Índice único para evitar duplicatas
CREATE UNIQUE INDEX idx_pedidos_provider_token ON public.pedidos (checkout_provider, transaction_token);

-- Trigger para updated_at
CREATE TRIGGER update_pedidos_updated_at
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
