
-- ===== 20260221232925 =====
CREATE TYPE public.shipment_status AS ENUM ('pendente', 'em_transito', 'saiu_para_entrega', 'entregue');

CREATE TABLE public.empresas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  razao_social TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  inscricao_estadual TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  telefone TEXT,
  email TEXT,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.envios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES public.empresas(id),
  cliente_nome TEXT NOT NULL,
  cliente_email TEXT NOT NULL,
  cliente_cpf TEXT,
  cliente_endereco TEXT,
  cliente_cidade TEXT,
  cliente_estado TEXT,
  cliente_cep TEXT,
  produto TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  codigo_rastreio TEXT,
  status public.shipment_status NOT NULL DEFAULT 'pendente',
  nfe_numero TEXT,
  nfe_serie TEXT,
  nfe_chave_acesso TEXT,
  transportadora TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to empresas" ON public.empresas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to envios" ON public.envios FOR ALL USING (true) WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);
CREATE POLICY "Public access to logos" ON storage.objects FOR SELECT USING (bucket_id = 'logos');
CREATE POLICY "Allow upload to logos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'logos');
CREATE POLICY "Allow update logos" ON storage.objects FOR UPDATE USING (bucket_id = 'logos');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_empresas_updated_at BEFORE UPDATE ON public.empresas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_envios_updated_at BEFORE UPDATE ON public.envios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== 20260221235625 =====
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS nome_fantasia text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS numero text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS bairro text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS complemento text;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS cliente_telefone text;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS cliente_numero text;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS cliente_bairro text;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS cliente_complemento text;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS quantidade integer NOT NULL DEFAULT 1;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS cfop text;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS ncm_sh text;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS cst text;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS unidade text NOT NULL DEFAULT 'UN';

-- ===== 20260224114911 =====
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
CREATE UNIQUE INDEX idx_pedidos_provider_token ON public.pedidos (checkout_provider, transaction_token);
CREATE TRIGGER update_pedidos_updated_at BEFORE UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== 20260224115530 =====
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.lojas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lojas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own lojas" ON public.lojas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own lojas" ON public.lojas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own lojas" ON public.lojas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own lojas" ON public.lojas FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_lojas_updated_at BEFORE UPDATE ON public.lojas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.check_max_lojas()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.lojas WHERE user_id = NEW.user_id) >= 5 THEN
    RAISE EXCEPTION 'Limite de 5 lojas por usuário atingido';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enforce_max_lojas BEFORE INSERT ON public.lojas FOR EACH ROW EXECUTE FUNCTION public.check_max_lojas();

CREATE OR REPLACE FUNCTION public.user_owns_loja(_user_id UUID, _loja_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.lojas WHERE id = _loja_id AND user_id = _user_id);
$$;

ALTER TABLE public.empresas ADD COLUMN loja_id UUID REFERENCES public.lojas(id) ON DELETE CASCADE;
DROP POLICY IF EXISTS "Allow all access to empresas" ON public.empresas;
CREATE POLICY "Users access own loja empresas" ON public.empresas FOR ALL
  USING (public.user_owns_loja(auth.uid(), loja_id)) WITH CHECK (public.user_owns_loja(auth.uid(), loja_id));

ALTER TABLE public.envios ADD COLUMN loja_id UUID REFERENCES public.lojas(id) ON DELETE CASCADE;
DROP POLICY IF EXISTS "Allow all access to envios" ON public.envios;
CREATE POLICY "Users access own loja envios" ON public.envios FOR ALL
  USING (public.user_owns_loja(auth.uid(), loja_id)) WITH CHECK (public.user_owns_loja(auth.uid(), loja_id));

ALTER TABLE public.pedidos ADD COLUMN loja_id UUID REFERENCES public.lojas(id) ON DELETE CASCADE;
CREATE POLICY "Users access own loja pedidos" ON public.pedidos FOR ALL
  USING (public.user_owns_loja(auth.uid(), loja_id)) WITH CHECK (public.user_owns_loja(auth.uid(), loja_id));

ALTER TABLE public.webhook_logs ADD COLUMN loja_id UUID REFERENCES public.lojas(id) ON DELETE CASCADE;
CREATE POLICY "Users access own loja webhook_logs" ON public.webhook_logs FOR ALL
  USING (public.user_owns_loja(auth.uid(), loja_id)) WITH CHECK (public.user_owns_loja(auth.uid(), loja_id));

CREATE INDEX idx_lojas_user_id ON public.lojas(user_id);
CREATE INDEX idx_lojas_slug ON public.lojas(slug);
CREATE INDEX idx_empresas_loja_id ON public.empresas(loja_id);
CREATE INDEX idx_envios_loja_id ON public.envios(loja_id);
CREATE INDEX idx_pedidos_loja_id ON public.pedidos(loja_id);
CREATE INDEX idx_webhook_logs_loja_id ON public.webhook_logs(loja_id);

-- ===== 20260224120059 =====
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
-- skipped seed: admin user does not exist in new DB

CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created_assign_role AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.assign_default_role();

-- ===== 20260224122306 =====
CREATE TABLE public.creditos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  saldo INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.creditos ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.creditos_transacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('adicao', 'consumo')),
  quantidade INTEGER NOT NULL,
  descricao TEXT,
  admin_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.creditos_transacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own credits" ON public.creditos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins full access credits" ON public.creditos FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users view own transactions" ON public.creditos_transacoes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins full access transactions" ON public.creditos_transacoes FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.create_user_credits()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.creditos (user_id, saldo) VALUES (NEW.id, 0);
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created_credits AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_user_credits();

INSERT INTO public.creditos (user_id, saldo)
SELECT id, 0 FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.creditos);

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view all lojas" ON public.lojas FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view all envios" ON public.envios FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- ===== 20260224131245 =====
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'coletado';
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'centro_local';
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'taxacao';
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'pagamento_confirmado';
