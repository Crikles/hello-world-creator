-- Consolidated schema migration

-- ===== 20260221232925_3855c50e-593c-48a9-bce0-5d4d77ae6ee3.sql =====


-- Create enum for shipment status
DO $w$ BEGIN CREATE TYPE public.shipment_status AS ENUM ('pendente', 'em_transito', 'saiu_para_entrega', 'entregue'); EXCEPTION WHEN duplicate_object THEN NULL; END $w$;

-- Create empresas table
CREATE TABLE IF NOT EXISTS public.empresas (
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

-- Create envios table
CREATE TABLE IF NOT EXISTS public.envios (
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

-- Enable RLS
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.envios ENABLE ROW LEVEL SECURITY;

-- Public read/write policies (no auth for MVP)
DROP POLICY IF EXISTS "Allow all access to empresas" ON public.empresas;
CREATE POLICY "Allow all access to empresas" ON public.empresas FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all access to envios" ON public.envios;
CREATE POLICY "Allow all access to envios" ON public.envios FOR ALL USING (true) WITH CHECK (true);

-- Create storage bucket for logos
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Public access to logos" ON storage.objects;
CREATE POLICY "Public access to logos" ON storage.objects FOR SELECT USING (bucket_id = 'logos');
DROP POLICY IF EXISTS "Allow upload to logos" ON storage.objects;
CREATE POLICY "Allow upload to logos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'logos');
DROP POLICY IF EXISTS "Allow update logos" ON storage.objects;
CREATE POLICY "Allow update logos" ON storage.objects FOR UPDATE USING (bucket_id = 'logos');

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_empresas_updated_at ON public.empresas;
CREATE TRIGGER update_empresas_updated_at BEFORE UPDATE ON public.empresas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_envios_updated_at ON public.envios;
CREATE TRIGGER update_envios_updated_at BEFORE UPDATE ON public.envios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();



-- ===== 20260221235625_e8e9bcbb-dee6-48c4-9c12-c3bad8a8ddd4.sql =====


-- Add missing columns to empresas
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS nome_fantasia text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS numero text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS bairro text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS complemento text;

-- Add missing columns to envios
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS cliente_telefone text;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS cliente_numero text;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS cliente_bairro text;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS cliente_complemento text;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS quantidade integer NOT NULL DEFAULT 1;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS cfop text;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS ncm_sh text;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS cst text;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS unidade text NOT NULL DEFAULT 'UN';



-- ===== 20260224114911_f8d21947-2ea0-4569-99c7-0c05caf7051e.sql =====


-- Tabela webhook_logs para auditoria
CREATE TABLE IF NOT EXISTS public.webhook_logs (
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
CREATE TABLE IF NOT EXISTS public.pedidos (
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_provider_token ON public.pedidos (checkout_provider, transaction_token);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_pedidos_updated_at ON public.pedidos;
CREATE TRIGGER update_pedidos_updated_at
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();



-- ===== 20260224115530_8f98d077-40d5-496c-a494-7431545f64a7.sql =====


-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 2. Create lojas table
CREATE TABLE IF NOT EXISTS public.lojas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lojas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own lojas" ON public.lojas;
CREATE POLICY "Users can view own lojas" ON public.lojas FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own lojas" ON public.lojas;
CREATE POLICY "Users can insert own lojas" ON public.lojas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own lojas" ON public.lojas;
CREATE POLICY "Users can update own lojas" ON public.lojas FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own lojas" ON public.lojas;
CREATE POLICY "Users can delete own lojas" ON public.lojas FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_lojas_updated_at ON public.lojas;
CREATE TRIGGER update_lojas_updated_at
  BEFORE UPDATE ON public.lojas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to enforce max 5 lojas per user
CREATE OR REPLACE FUNCTION public.check_max_lojas()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.lojas WHERE user_id = NEW.user_id) >= 5 THEN
    RAISE EXCEPTION 'Limite de 5 lojas por usuário atingido';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_max_lojas ON public.lojas;
CREATE TRIGGER enforce_max_lojas
  BEFORE INSERT ON public.lojas
  FOR EACH ROW
  EXECUTE FUNCTION public.check_max_lojas();

-- 3. Add loja_id to existing tables

-- Helper function to check if user owns a loja (avoids recursion)
CREATE OR REPLACE FUNCTION public.user_owns_loja(_user_id UUID, _loja_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lojas
    WHERE id = _loja_id AND user_id = _user_id
  );
$$;

-- empresas: add loja_id, drop old permissive policy, add new
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS loja_id UUID REFERENCES public.lojas(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Allow all access to empresas" ON public.empresas;

DROP POLICY IF EXISTS "Users access own loja empresas" ON public.empresas;
CREATE POLICY "Users access own loja empresas" ON public.empresas FOR ALL
  USING (public.user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (public.user_owns_loja(auth.uid(), loja_id));

-- envios: add loja_id, drop old policy, add new
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS loja_id UUID REFERENCES public.lojas(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Allow all access to envios" ON public.envios;

DROP POLICY IF EXISTS "Users access own loja envios" ON public.envios;
CREATE POLICY "Users access own loja envios" ON public.envios FOR ALL
  USING (public.user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (public.user_owns_loja(auth.uid(), loja_id));

-- pedidos: add loja_id
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS loja_id UUID REFERENCES public.lojas(id) ON DELETE CASCADE;

ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own loja pedidos" ON public.pedidos;
CREATE POLICY "Users access own loja pedidos" ON public.pedidos FOR ALL
  USING (public.user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (public.user_owns_loja(auth.uid(), loja_id));

-- webhook_logs: add loja_id
ALTER TABLE public.webhook_logs ADD COLUMN IF NOT EXISTS loja_id UUID REFERENCES public.lojas(id) ON DELETE CASCADE;

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own loja webhook_logs" ON public.webhook_logs;
CREATE POLICY "Users access own loja webhook_logs" ON public.webhook_logs FOR ALL
  USING (public.user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (public.user_owns_loja(auth.uid(), loja_id));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lojas_user_id ON public.lojas(user_id);
CREATE INDEX IF NOT EXISTS idx_lojas_slug ON public.lojas(slug);
CREATE INDEX IF NOT EXISTS idx_empresas_loja_id ON public.empresas(loja_id);
CREATE INDEX IF NOT EXISTS idx_envios_loja_id ON public.envios(loja_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_loja_id ON public.pedidos(loja_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_loja_id ON public.webhook_logs(loja_id);



-- ===== 20260224120059_7174c692-99ea-420a-aabf-e2ab5af8297c.sql =====


-- 1. Create role enum
DO $w$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin', 'user'); EXCEPTION WHEN duplicate_object THEN NULL; END $w$;

-- 2. Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- 4. RLS: users can read their own roles, admins can read all
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. Only admins can manage roles
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. Assign admin role to the master account
INSERT INTO public.user_roles (user_id, role)
VALUES ('e1687e97-21e3-4f4b-8af6-ddfe5b77c651', 'admin');

-- 7. Auto-assign 'user' role on signup
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_default_role();



-- ===== 20260224122306_506eefe0-2e91-43e0-ac20-6ddd6fd89cef.sql =====


-- Tabela creditos (saldo por usuario)
CREATE TABLE IF NOT EXISTS public.creditos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  saldo INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.creditos ENABLE ROW LEVEL SECURITY;

-- Tabela creditos_transacoes (historico)
CREATE TABLE IF NOT EXISTS public.creditos_transacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('adicao', 'consumo')),
  quantidade INTEGER NOT NULL,
  descricao TEXT,
  admin_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.creditos_transacoes ENABLE ROW LEVEL SECURITY;

-- RLS creditos
DROP POLICY IF EXISTS "Users view own credits" ON public.creditos;
CREATE POLICY "Users view own credits" ON public.creditos
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins full access credits" ON public.creditos;
CREATE POLICY "Admins full access credits" ON public.creditos
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS creditos_transacoes
DROP POLICY IF EXISTS "Users view own transactions" ON public.creditos_transacoes;
CREATE POLICY "Users view own transactions" ON public.creditos_transacoes
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins full access transactions" ON public.creditos_transacoes;
CREATE POLICY "Admins full access transactions" ON public.creditos_transacoes
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger: criar saldo ao cadastrar usuario
CREATE OR REPLACE FUNCTION public.create_user_credits()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.creditos (user_id, saldo) VALUES (NEW.id, 0);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created_credits ON auth.users;
CREATE TRIGGER on_auth_user_created_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_user_credits();

-- Criar saldo para usuarios existentes que ainda nao tem
INSERT INTO public.creditos (user_id, saldo)
SELECT id, 0 FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.creditos);

-- Admin precisa ler todos os profiles e lojas e envios
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can view all lojas" ON public.lojas;
CREATE POLICY "Admins can view all lojas" ON public.lojas
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can view all envios" ON public.envios;
CREATE POLICY "Admins can view all envios" ON public.envios
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));



-- ===== 20260224131245_f38d66f1-d390-46f1-9b3f-c3a73cde6293.sql =====


-- Add new shipment statuses
-- ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'coletado';
-- ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'centro_local';
-- ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'taxacao';
-- ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'pagamento_confirmado';

-- Templates table
CREATE TABLE IF NOT EXISTS public.postagem_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id uuid REFERENCES public.lojas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  tipo text NOT NULL DEFAULT 'custom',
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.postagem_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read system templates" ON public.postagem_templates;
CREATE POLICY "Anyone can read system templates" ON public.postagem_templates FOR SELECT
  USING (is_system = true);

DROP POLICY IF EXISTS "Users access own loja templates" ON public.postagem_templates;
CREATE POLICY "Users access own loja templates" ON public.postagem_templates FOR ALL
  USING (user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (user_owns_loja(auth.uid(), loja_id));

-- Eventos table
CREATE TABLE IF NOT EXISTS public.postagem_eventos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES public.postagem_templates(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  status_label text,
  ordem integer NOT NULL DEFAULT 0,
  delay_horas integer NOT NULL DEFAULT 0,
  enviar_email boolean NOT NULL DEFAULT true,
  enviar_nfe_pdf boolean NOT NULL DEFAULT false,
  assunto_email text,
  corpo_email text,
  is_final boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.postagem_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read system template eventos" ON public.postagem_eventos;
CREATE POLICY "Anyone can read system template eventos" ON public.postagem_eventos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.postagem_templates t
    WHERE t.id = template_id AND t.is_system = true
  ));

DROP POLICY IF EXISTS "Users access own loja template eventos" ON public.postagem_eventos;
CREATE POLICY "Users access own loja template eventos" ON public.postagem_eventos FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.postagem_templates t
    WHERE t.id = template_id AND user_owns_loja(auth.uid(), t.loja_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.postagem_templates t
    WHERE t.id = template_id AND user_owns_loja(auth.uid(), t.loja_id)
  ));

-- Config table
CREATE TABLE IF NOT EXISTS public.postagem_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE UNIQUE,
  template_ativo_id uuid REFERENCES public.postagem_templates(id) ON DELETE SET NULL,
  enviar_emails boolean NOT NULL DEFAULT true,
  enviar_nfe_email boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.postagem_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own loja config" ON public.postagem_config;
CREATE POLICY "Users access own loja config" ON public.postagem_config FOR ALL
  USING (user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (user_owns_loja(auth.uid(), loja_id));

DROP TRIGGER IF EXISTS update_postagem_config_updated_at ON public.postagem_config;
CREATE TRIGGER update_postagem_config_updated_at
  BEFORE UPDATE ON public.postagem_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Email log table
CREATE TABLE IF NOT EXISTS public.postagem_email_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  envio_id uuid REFERENCES public.envios(id) ON DELETE SET NULL,
  evento_id uuid REFERENCES public.postagem_eventos(id) ON DELETE SET NULL,
  destinatario text NOT NULL,
  assunto text,
  status text NOT NULL DEFAULT 'pending',
  custo numeric NOT NULL DEFAULT 0.15,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.postagem_email_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own loja email logs" ON public.postagem_email_log;
CREATE POLICY "Users access own loja email logs" ON public.postagem_email_log FOR ALL
  USING (user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (user_owns_loja(auth.uid(), loja_id));

-- Seed system templates
-- Nacional Padrão
INSERT INTO public.postagem_templates (id, loja_id, nome, descricao, tipo, is_system) VALUES
  ('00000000-0000-0000-0000-000000000001', null, 'Nacional Padrão', 'Fluxo padrão com 6 eventos de rastreamento', 'padrao', true);

INSERT INTO public.postagem_eventos (template_id, nome, descricao, status_label, ordem, delay_horas, enviar_email, enviar_nfe_pdf, assunto_email, corpo_email, is_final) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Nota Fiscal Emitida', 'A nota fiscal do pedido foi emitida', 'Postado', 1, 0, true, true, 'Nota Fiscal Emitida - {{produto}}', '<p>Olá {{cliente_nome}},</p><p>Sua nota fiscal foi emitida para o produto <b>{{produto}}</b>.</p><p>Código de rastreio: {{codigo_rastreio}}</p>', false),
  ('00000000-0000-0000-0000-000000000001', 'Pedido Coletado', 'O pedido foi coletado pela transportadora', 'Coletado', 2, 2, true, false, 'Pedido Coletado - {{produto}}', '<p>Olá {{cliente_nome}},</p><p>Seu pedido <b>{{produto}}</b> foi coletado pela transportadora.</p>', false),
  ('00000000-0000-0000-0000-000000000001', 'Em Trânsito', 'O pedido está em trânsito', 'Em Trânsito', 3, 24, true, false, 'Pedido em Trânsito - {{produto}}', '<p>Olá {{cliente_nome}},</p><p>Seu pedido <b>{{produto}}</b> está em trânsito.</p>', false),
  ('00000000-0000-0000-0000-000000000001', 'Centro de Distribuição', 'O pedido chegou ao centro de distribuição local', 'Centro Local', 4, 48, true, false, 'Pedido no Centro de Distribuição - {{produto}}', '<p>Olá {{cliente_nome}},</p><p>Seu pedido <b>{{produto}}</b> chegou ao centro de distribuição da sua região.</p>', false),
  ('00000000-0000-0000-0000-000000000001', 'Saiu para Entrega', 'O pedido saiu para entrega', 'Saiu para Entrega', 5, 2, true, false, 'Pedido Saiu para Entrega - {{produto}}', '<p>Olá {{cliente_nome}},</p><p>Seu pedido <b>{{produto}}</b> saiu para entrega! Fique atento.</p>', false),
  ('00000000-0000-0000-0000-000000000001', 'Entregue', 'O pedido foi entregue com sucesso', 'Entregue', 6, 4, true, false, 'Pedido Entregue - {{produto}}', '<p>Olá {{cliente_nome}},</p><p>Seu pedido <b>{{produto}}</b> foi entregue com sucesso!</p>', true);

-- Nacional Taxação
INSERT INTO public.postagem_templates (id, loja_id, nome, descricao, tipo, is_system) VALUES
  ('00000000-0000-0000-0000-000000000002', null, 'Nacional Taxação', 'Fluxo com taxação alfandegária - 8 eventos', 'taxacao', true);

INSERT INTO public.postagem_eventos (template_id, nome, descricao, status_label, ordem, delay_horas, enviar_email, enviar_nfe_pdf, assunto_email, corpo_email, is_final) VALUES
  ('00000000-0000-0000-0000-000000000002', 'Nota Fiscal Emitida', 'A nota fiscal do pedido foi emitida', 'Postado', 1, 0, true, true, 'Nota Fiscal Emitida - {{produto}}', '<p>Olá {{cliente_nome}},</p><p>Sua nota fiscal foi emitida para o produto <b>{{produto}}</b>.</p>', false),
  ('00000000-0000-0000-0000-000000000002', 'Pedido Coletado', 'O pedido foi coletado pela transportadora', 'Coletado', 2, 2, true, false, 'Pedido Coletado - {{produto}}', '<p>Olá {{cliente_nome}},</p><p>Seu pedido <b>{{produto}}</b> foi coletado.</p>', false),
  ('00000000-0000-0000-0000-000000000002', 'Em Trânsito', 'O pedido está em trânsito', 'Em Trânsito', 3, 24, true, false, 'Pedido em Trânsito - {{produto}}', '<p>Olá {{cliente_nome}},</p><p>Seu pedido está em trânsito.</p>', false),
  ('00000000-0000-0000-0000-000000000002', 'Centro de Distribuição', 'O pedido chegou ao centro de distribuição', 'Centro Local', 4, 48, true, false, 'Centro de Distribuição - {{produto}}', '<p>Olá {{cliente_nome}},</p><p>Seu pedido chegou ao centro de distribuição.</p>', false),
  ('00000000-0000-0000-0000-000000000002', 'Aguardando Pagamento', 'Pedido taxado - aguardando pagamento', 'Taxação', 5, 2, true, false, 'Pagamento Pendente - Taxação - {{produto}}', '<p>Olá {{cliente_nome}},</p><p>Seu pedido <b>{{produto}}</b> foi taxado e está aguardando pagamento.</p>', false),
  ('00000000-0000-0000-0000-000000000002', 'Pagamento Confirmado', 'Pagamento da taxação confirmado', 'Pago', 6, 0, true, false, 'Pagamento Confirmado - {{produto}}', '<p>Olá {{cliente_nome}},</p><p>O pagamento da taxação do pedido <b>{{produto}}</b> foi confirmado.</p>', false),
  ('00000000-0000-0000-0000-000000000002', 'Saiu para Entrega', 'O pedido saiu para entrega', 'Saiu para Entrega', 7, 2, true, false, 'Saiu para Entrega - {{produto}}', '<p>Olá {{cliente_nome}},</p><p>Seu pedido saiu para entrega!</p>', false),
  ('00000000-0000-0000-0000-000000000002', 'Entregue', 'O pedido foi entregue', 'Entregue', 8, 4, true, false, 'Pedido Entregue - {{produto}}', '<p>Olá {{cliente_nome}},</p><p>Seu pedido foi entregue com sucesso!</p>', true);

-- Nacional Expressa
INSERT INTO public.postagem_templates (id, loja_id, nome, descricao, tipo, is_system) VALUES
  ('00000000-0000-0000-0000-000000000003', null, 'Nacional Expressa', 'Fluxo expresso com 3 eventos', 'expressa', true);

INSERT INTO public.postagem_eventos (template_id, nome, descricao, status_label, ordem, delay_horas, enviar_email, enviar_nfe_pdf, assunto_email, corpo_email, is_final) VALUES
  ('00000000-0000-0000-0000-000000000003', 'Pedido Confirmado', 'O pedido foi confirmado e coletado', 'Coletado', 1, 0, true, true, 'Pedido Confirmado - {{produto}}', '<p>Olá {{cliente_nome}},</p><p>Seu pedido <b>{{produto}}</b> foi confirmado!</p>', false),
  ('00000000-0000-0000-0000-000000000003', 'Em Rota de Entrega', 'O pedido está em rota de entrega', 'Em Rota', 2, 24, true, false, 'Em Rota de Entrega - {{produto}}', '<p>Olá {{cliente_nome}},</p><p>Seu pedido está em rota de entrega.</p>', false),
  ('00000000-0000-0000-0000-000000000003', 'Entregue', 'O pedido foi entregue', 'Entregue', 3, 4, true, false, 'Pedido Entregue - {{produto}}', '<p>Olá {{cliente_nome}},</p><p>Seu pedido foi entregue com sucesso!</p>', true);



-- ===== 20260224135532_398b1669-3d33-4285-bb7b-fee2ee48c826.sql =====


ALTER TABLE public.postagem_config
ADD COLUMN IF NOT EXISTS ativar_site_rastreio boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS ativar_taxacao boolean NOT NULL DEFAULT false;



-- ===== 20260224141636_03736863-c517-49fe-aa8c-affecf437f4b.sql =====

DROP POLICY IF EXISTS "Admins can view all email logs" ON public.postagem_email_log;
CREATE POLICY "Admins can view all email logs" ON public.postagem_email_log
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));


-- ===== 20260224162435_eb6b8328-8deb-48d2-9503-006eb6ac5fd6.sql =====

DROP POLICY IF EXISTS "Admins can manage system template eventos" ON public.postagem_eventos;
CREATE POLICY "Admins can manage system template eventos" ON public.postagem_eventos
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));


-- ===== 20260224211302_4f59a366-32f8-4576-8ec4-d2d2ba6e584c.sql =====

-- Add FK between envios.empresa_id and empresas.id (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'envios_empresa_id_fkey'
    AND table_name = 'envios'
  ) THEN
    DO $c$ BEGIN ALTER TABLE public.envios
      ADD CONSTRAINT envios_empresa_id_fkey
      FOREIGN KEY (empresa_id) REFERENCES public.empresas(id)
      ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $c$;
  END IF;
END $$;


-- ===== 20260224213821_402325f5-6afc-4daf-859a-01f19d765fee.sql =====

ALTER TABLE public.postagem_config
  ADD COLUMN IF NOT EXISTS email_remetente TEXT DEFAULT 'noreply@jltransportes.pro';


-- ===== 20260225022822_69b05ff2-654d-4eb4-ac80-17d1fc6113a0.sql =====

ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS ultimo_evento_ordem integer NOT NULL DEFAULT 0;


-- ===== 20260225162748_a74e8267-ab22-4716-ae50-cda833c2db53.sql =====


CREATE OR REPLACE FUNCTION public.generate_tracking_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  IF NEW.codigo_rastreio IS NULL OR NEW.codigo_rastreio = '' THEN
    LOOP
      new_code := 'BR' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10));
      SELECT EXISTS(SELECT 1 FROM envios WHERE codigo_rastreio = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    NEW.codigo_rastreio := new_code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_generate_tracking_code ON public.envios;
CREATE TRIGGER trigger_generate_tracking_code
  BEFORE INSERT ON public.envios
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_tracking_code();



-- ===== 20260225182549_650c144d-45b8-46ea-8126-118d573f17a6.sql =====

ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS status_label text;

ALTER PUBLICATION supabase_realtime ADD TABLE public.envios;


-- ===== 20260225234229_5ecf02c7-7c3b-4f3c-8d49-4b86c42ed5a4.sql =====


CREATE TABLE IF NOT EXISTS public.system_config (
  key TEXT PRIMARY KEY,
  value NUMERIC NOT NULL DEFAULT 0,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access system_config" ON public.system_config;
CREATE POLICY "Admins full access system_config" ON public.system_config FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated users can read system_config" ON public.system_config;
CREATE POLICY "Authenticated users can read system_config" ON public.system_config FOR SELECT
  USING (auth.role() = 'authenticated');

DROP TRIGGER IF EXISTS update_system_config_updated_at ON public.system_config;
CREATE TRIGGER update_system_config_updated_at
  BEFORE UPDATE ON public.system_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.system_config (key, value, label) VALUES
  ('custo_nfe_email', 1, 'Nota Fiscal por email'),
  ('custo_email_rastreio', 1, 'Fluxo de rastreio por email'),
  ('custo_sms_rastreio', 0.25, 'Site de rastreio (SMS)'),
  ('custo_taxacao', 1, 'Funil de taxação'),
  ('custo_envio_email', 0.15, 'Custo unitário por email enviado');



-- ===== 20260226214113_e8ae0fbe-6d8d-401b-96a5-4d007b9ba399.sql =====


CREATE OR REPLACE FUNCTION public.debit_user_credits(
  _user_id UUID,
  _quantidade NUMERIC,
  _descricao TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_saldo NUMERIC;
BEGIN
  SELECT saldo INTO current_saldo
  FROM creditos WHERE user_id = _user_id FOR UPDATE;

  IF current_saldo IS NULL OR current_saldo < _quantidade THEN
    RETURN FALSE;
  END IF;

  UPDATE creditos
  SET saldo = saldo - _quantidade, updated_at = now()
  WHERE user_id = _user_id;

  INSERT INTO creditos_transacoes (user_id, tipo, quantidade, descricao)
  VALUES (_user_id, 'consumo', _quantidade, _descricao);

  RETURN TRUE;
END;
$$;



-- ===== 20260227145912_d978e7d3-fd91-4982-8a07-689ab4684fd8.sql =====


-- Create private bucket for temporary NF-e PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('nfe-pdfs', 'nfe-pdfs', false) ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
DROP POLICY IF EXISTS "Authenticated users can upload NF-e PDFs" ON storage.objects;
CREATE POLICY "Authenticated users can upload NF-e PDFs" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'nfe-pdfs' AND auth.role() = 'authenticated');

-- Allow service role to read (for edge function download)
DROP POLICY IF EXISTS "Service role can read NF-e PDFs" ON storage.objects;
CREATE POLICY "Service role can read NF-e PDFs" ON storage.objects FOR SELECT
USING (bucket_id = 'nfe-pdfs');

-- Allow service role to delete (cleanup after sending)
DROP POLICY IF EXISTS "Service role can delete NF-e PDFs" ON storage.objects;
CREATE POLICY "Service role can delete NF-e PDFs" ON storage.objects FOR DELETE
USING (bucket_id = 'nfe-pdfs');



-- ===== 20260227151137_0d16144b-0fcf-4c7a-a73e-5bc7b5837cd5.sql =====


-- Alter creditos.saldo from integer to numeric
ALTER TABLE public.creditos ALTER COLUMN saldo TYPE numeric USING saldo::numeric;
ALTER TABLE public.creditos ALTER COLUMN saldo SET DEFAULT 0;

-- Alter creditos_transacoes.quantidade from integer to numeric
ALTER TABLE public.creditos_transacoes ALTER COLUMN quantidade TYPE numeric USING quantidade::numeric;



-- ===== 20260227151855_0dd7c385-d11c-4a45-9114-398f003bd249.sql =====


-- Enable realtime for creditos table
ALTER PUBLICATION supabase_realtime ADD TABLE public.creditos;

-- Add soft delete column to envios
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;



-- ===== 20260227161928_d8289524-6959-4a3b-bc5f-6504d894f492.sql =====


-- Tabela para templates de SMS editáveis
CREATE TABLE IF NOT EXISTS public.sms_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_key text UNIQUE NOT NULL,
  status_label text NOT NULL,
  mensagem text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access sms_templates" ON public.sms_templates;
CREATE POLICY "Admins full access sms_templates" ON public.sms_templates FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated users can read sms_templates" ON public.sms_templates;
CREATE POLICY "Authenticated users can read sms_templates" ON public.sms_templates FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

-- Trigger updated_at
DROP TRIGGER IF EXISTS update_sms_templates_updated_at ON public.sms_templates;
CREATE TRIGGER update_sms_templates_updated_at
  BEFORE UPDATE ON public.sms_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed data com as 9 mensagens atuais
INSERT INTO public.sms_templates (status_key, status_label, mensagem) VALUES
  ('Coletado', 'Coletado', 'Ola {nome}. Seu CODIGO DE RASTREIO esta disponivel, acesse: [{link}] FIQUE ATENTO A SEU EMAIL.'),
  ('Postado', 'Postado', 'Ola {nome}. Seu CODIGO DE RASTREIO esta disponivel, acesse: [{link}] FIQUE ATENTO A SEU EMAIL.'),
  ('Em Transito', 'Em Trânsito', 'Ola {nome}, seu produto esta em transito. Acesse: [{link}] para acompanhar.'),
  ('Centro Local', 'Centro Local', 'Ola {nome}, seu produto esta no centro de distribuicao. Acesse: [{link}] para acompanhar.'),
  ('Taxacao', 'Taxação', 'Ola {nome}, seu produto esta em observacao. Confira seu e-mail e acesse: [{link}]'),
  ('Pago', 'Pago', 'Ola {nome}, pagamento confirmado. Acesse: [{link}] para acompanhar a entrega.'),
  ('Saiu para Entrega', 'Saiu para Entrega', 'Ola {nome}, seu produto saiu para entrega. Acesse: [{link}] para acompanhar.'),
  ('Em Rota', 'Em Rota', 'Ola {nome}, seu produto saiu para entrega. Acesse: [{link}] para acompanhar.'),
  ('Entregue', 'Entregue', 'Ola {nome}, seu produto foi entregue! Acesse: [{link}] para mais detalhes.'),
  ('default', 'Padrão', 'Ola {nome}, atualizacao do seu pedido. Acesse: [{link}] para acompanhar.');



-- ===== 20260227163100_7b749c53-cb2a-45f7-96b3-2e1b5c8654b9.sql =====


-- Tabela leads
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cpf text,
  telefone text,
  email text NOT NULL,
  produto text,
  valor numeric DEFAULT 0,
  endereco text,
  numero text,
  bairro text,
  complemento text,
  cidade text,
  estado text,
  cep text,
  loja_id uuid,
  envio_id uuid,
  created_at timestamptz DEFAULT now()
);

-- RLS: somente admins
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access leads" ON public.leads;
CREATE POLICY "Admins full access leads" ON public.leads FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Indice unico parcial para upsert
CREATE UNIQUE INDEX IF NOT EXISTS leads_envio_id_unique ON public.leads (envio_id) WHERE envio_id IS NOT NULL;

-- Funcao trigger para capturar leads dos envios
CREATE OR REPLACE FUNCTION public.capture_lead_from_envio()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public' AS $$
BEGIN
  INSERT INTO public.leads (nome, cpf, telefone, email, produto, valor, endereco, numero, bairro, complemento, cidade, estado, cep, loja_id, envio_id)
  VALUES (
    NEW.cliente_nome,
    NEW.cliente_cpf,
    NEW.cliente_telefone,
    NEW.cliente_email,
    NEW.produto,
    NEW.valor,
    NEW.cliente_endereco,
    NEW.cliente_numero,
    NEW.cliente_bairro,
    NEW.cliente_complemento,
    NEW.cliente_cidade,
    NEW.cliente_estado,
    NEW.cliente_cep,
    NEW.loja_id,
    NEW.id
  )
  ON CONFLICT (envio_id) WHERE envio_id IS NOT NULL
  DO UPDATE SET
    nome = EXCLUDED.nome,
    cpf = EXCLUDED.cpf,
    telefone = EXCLUDED.telefone,
    email = EXCLUDED.email,
    produto = EXCLUDED.produto,
    valor = EXCLUDED.valor,
    endereco = EXCLUDED.endereco,
    numero = EXCLUDED.numero,
    bairro = EXCLUDED.bairro,
    complemento = EXCLUDED.complemento,
    cidade = EXCLUDED.cidade,
    estado = EXCLUDED.estado,
    cep = EXCLUDED.cep;
  RETURN NEW;
END;
$$;

-- Trigger
DROP TRIGGER IF EXISTS on_envio_capture_lead ON public.envios;
CREATE TRIGGER on_envio_capture_lead
  AFTER INSERT OR UPDATE ON public.envios
  FOR EACH ROW EXECUTE FUNCTION capture_lead_from_envio();



-- ===== 20260227164600_f4ff9df6-5603-43dd-9de3-9efe2c18b3c2.sql =====

DO $c$ BEGIN ALTER TABLE public.leads ADD CONSTRAINT leads_loja_id_fkey FOREIGN KEY (loja_id) REFERENCES public.lojas(id); EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $c$;

-- Consolidated schema migration

-- ===== 20260227170000_create_push_subscriptions.sql =====

-- ═══════════════════════════════════════════════════════════
-- Push Subscriptions table for Web Push notifications
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL UNIQUE,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  codigo_rastreio TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (public tracking page visitors)
DROP POLICY IF EXISTS "Allow anonymous inserts" ON public.push_subscriptions;
CREATE POLICY "Allow anonymous inserts" ON public.push_subscriptions
  FOR INSERT WITH CHECK (true);

-- Allow reads for service role (edge functions)
DROP POLICY IF EXISTS "Allow service role reads" ON public.push_subscriptions;
CREATE POLICY "Allow service role reads" ON public.push_subscriptions
  FOR SELECT USING (true);


-- ═══════════════════════════════════════════════════════════
-- Push notification settings (admin-managed)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.push_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  icon_url TEXT DEFAULT '/favicon.ico',
  badge_url TEXT DEFAULT '/favicon.ico',
  default_url TEXT DEFAULT '/',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.push_notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated reads" ON public.push_notification_settings;
CREATE POLICY "Allow authenticated reads" ON public.push_notification_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated updates" ON public.push_notification_settings;
CREATE POLICY "Allow authenticated updates" ON public.push_notification_settings
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow authenticated inserts" ON public.push_notification_settings;
CREATE POLICY "Allow authenticated inserts" ON public.push_notification_settings
  FOR INSERT WITH CHECK (true);

-- Seed with default values
INSERT INTO public.push_notification_settings (icon_url, badge_url, default_url)
VALUES ('/favicon.ico', '/favicon.ico', '/')
ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════
-- Push notification log (history of sent notifications)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.push_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT,
  icon_url TEXT,
  total_sent INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.push_notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated reads on log" ON public.push_notification_log;
CREATE POLICY "Allow authenticated reads on log" ON public.push_notification_log
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow inserts on log" ON public.push_notification_log;
CREATE POLICY "Allow inserts on log" ON public.push_notification_log
  FOR INSERT WITH CHECK (true);



-- ===== 20260227171901_e387df62-1225-41db-98a0-1df9f6b166ba.sql =====


-- 1. push_subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  codigo_rastreio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public insert push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "Public insert push_subscriptions" ON public.push_subscriptions FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public select push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "Public select push_subscriptions" ON public.push_subscriptions FOR SELECT
  USING (true);

-- 2. push_notification_settings
CREATE TABLE IF NOT EXISTS public.push_notification_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  icon_url TEXT DEFAULT '/favicon.ico',
  badge_url TEXT DEFAULT '/favicon.ico',
  default_url TEXT DEFAULT '/',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.push_notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public select push_notification_settings" ON public.push_notification_settings;
CREATE POLICY "Public select push_notification_settings" ON public.push_notification_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public insert push_notification_settings" ON public.push_notification_settings;
CREATE POLICY "Public insert push_notification_settings" ON public.push_notification_settings FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public update push_notification_settings" ON public.push_notification_settings;
CREATE POLICY "Public update push_notification_settings" ON public.push_notification_settings FOR UPDATE
  USING (true);

-- Insert default row
INSERT INTO public.push_notification_settings (icon_url, badge_url, default_url)
VALUES ('/favicon.ico', '/favicon.ico', '/');

-- 3. push_notification_log
CREATE TABLE IF NOT EXISTS public.push_notification_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT,
  icon_url TEXT,
  total_sent INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.push_notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public select push_notification_log" ON public.push_notification_log;
CREATE POLICY "Public select push_notification_log" ON public.push_notification_log FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public insert push_notification_log" ON public.push_notification_log;
CREATE POLICY "Public insert push_notification_log" ON public.push_notification_log FOR INSERT
  WITH CHECK (true);



-- ===== 20260227190450_56711260-0999-45e3-bbd9-c1c82798a32b.sql =====

ALTER TABLE public.postagem_config
ADD COLUMN IF NOT EXISTS origem_cidade text,
ADD COLUMN IF NOT EXISTS origem_estado text;


-- ===== 20260227193800_create_pix_payments.sql =====

-- Create pix_payments table to track PIX payment requests for credit purchases
CREATE TABLE IF NOT EXISTS pix_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id text UNIQUE,
  amount_cents integer NOT NULL,
  moedas numeric NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  qr_code_base64 text,
  copy_paste text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

-- Index for fast lookup by transaction_id (webhook)
CREATE INDEX IF NOT EXISTS idx_pix_payments_transaction_id ON pix_payments(transaction_id);
-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_pix_payments_user_id ON pix_payments(user_id);

-- RLS
ALTER TABLE pix_payments ENABLE ROW LEVEL SECURITY;

-- Users can view their own pix payments
DROP POLICY IF EXISTS "Users can view own pix_payments" ON pix_payments;
CREATE POLICY "Users can view own pix_payments" ON pix_payments FOR SELECT
  USING (auth.uid() = user_id);

-- Only service_role (edge functions) can insert/update
DROP POLICY IF EXISTS "Service role can manage pix_payments" ON pix_payments;
CREATE POLICY "Service role can manage pix_payments" ON pix_payments FOR ALL
  USING (auth.role() = 'service_role');



-- ===== 20260227195235_dca93eab-9f3d-4a95-8b7e-b1594c5540da.sql =====


CREATE TABLE IF NOT EXISTS public.pix_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  transaction_id text UNIQUE,
  amount_cents integer NOT NULL,
  moedas numeric NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  qr_code_base64 text,
  copy_paste text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_pix_payments_transaction_id ON public.pix_payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_pix_payments_user_id ON public.pix_payments(user_id);

ALTER TABLE public.pix_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own pix_payments" ON public.pix_payments;
CREATE POLICY "Users can view own pix_payments" ON public.pix_payments FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage pix_payments" ON public.pix_payments;
CREATE POLICY "Service role can manage pix_payments" ON public.pix_payments FOR ALL
USING (auth.role() = 'service_role');



-- ===== 20260227213843_06adfd01-8d59-4de7-a361-85926c50f11e.sql =====

DROP POLICY IF EXISTS "Admins can view all pix_payments" ON public.pix_payments;
CREATE POLICY "Admins can view all pix_payments" ON public.pix_payments FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));


-- ===== 20260227224634_create_shopify_integrations.sql =====

CREATE TABLE IF NOT EXISTS public.shopify_integrations (
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

DROP POLICY IF EXISTS "Users access own loja shopify integrations" ON public.shopify_integrations;
CREATE POLICY "Users access own loja shopify integrations" ON public.shopify_integrations FOR ALL
    USING (public.user_owns_loja(auth.uid(), loja_id))
    WITH CHECK (public.user_owns_loja(auth.uid(), loja_id));

DROP TRIGGER IF EXISTS update_shopify_integrations_updated_at ON public.shopify_integrations;
CREATE TRIGGER update_shopify_integrations_updated_at
    BEFORE UPDATE ON public.shopify_integrations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_shopify_integrations_loja_id ON public.shopify_integrations(loja_id);



-- ===== 20260227230904_9c80351c-f3c2-453d-aadf-350fd0d92ebe.sql =====


CREATE TABLE IF NOT EXISTS public.shopify_integrations (
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

DROP POLICY IF EXISTS "Users access own loja shopify_integrations" ON public.shopify_integrations;
CREATE POLICY "Users access own loja shopify_integrations" ON public.shopify_integrations
FOR ALL
USING (user_owns_loja(auth.uid(), loja_id))
WITH CHECK (user_owns_loja(auth.uid(), loja_id));

DROP POLICY IF EXISTS "Service role full access shopify_integrations" ON public.shopify_integrations;
CREATE POLICY "Service role full access shopify_integrations" ON public.shopify_integrations
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_shopify_integrations_updated_at ON public.shopify_integrations;
CREATE TRIGGER update_shopify_integrations_updated_at
BEFORE UPDATE ON public.shopify_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_shopify_integrations_loja_id ON public.shopify_integrations(loja_id);



-- ===== 20260228000639_897fed8a-ca88-4b06-80f6-093d4a7943e5.sql =====

ALTER TABLE public.shopify_integrations ADD COLUMN IF NOT EXISTS ativo boolean DEFAULT true;


-- ===== 20260228001131_57928456-d74b-4250-8389-40252d019d1f.sql =====

CREATE TABLE IF NOT EXISTS public.checkout_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL,
  checkout_id text NOT NULL,
  ativo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(loja_id, checkout_id)
);

ALTER TABLE public.checkout_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own loja checkout_integrations" ON public.checkout_integrations;
CREATE POLICY "Users access own loja checkout_integrations" ON public.checkout_integrations FOR ALL
  USING (user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (user_owns_loja(auth.uid(), loja_id));


-- ===== 20260228043439_f4ddac50-91ce-48a1-99cc-e0588ba9f369.sql =====

ALTER TABLE public.lojas 
  ADD COLUMN IF NOT EXISTS webhook_token text 
  DEFAULT encode(gen_random_bytes(6), 'hex') 
  NOT NULL 
  UNIQUE;


-- ===== 20260228044129_a5bd8ece-6acd-49c5-ab67-fb993660bf9e.sql =====

ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS proximo_avanco_em timestamptz;


-- ===== 20260228045049_19542050-9be9-4b4a-94ba-14dc56325a9c.sql =====


-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Add auto_envio column to postagem_config
ALTER TABLE public.postagem_config ADD COLUMN IF NOT EXISTS auto_envio boolean DEFAULT false;



-- ===== 20260228105806_add_custom_prices_to_profiles.sql =====

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_prices JSONB DEFAULT '{}'::jsonb;



-- ===== 20260228110527_whatsapp_suporte.sql =====

INSERT INTO public.system_config (key, value, label)
VALUES ('whatsapp_suporte', 5511999999999, 'WhatsApp Suporte')
ON CONFLICT (key) DO NOTHING;



-- ===== 20260228144140_3f6107fe-23fa-46fe-9619-a9f1eb92dfeb.sql =====


-- Add custom_prices JSONB column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_prices JSONB DEFAULT '{}'::jsonb;

-- Allow admins to update any profile (needed for setting custom_prices)
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));



-- ===== 20260228153958_a82da223-bf2e-441e-ade1-71811b253196.sql =====

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS blocked boolean NOT NULL DEFAULT false;


-- ===== 20260228174350_25172760-cb72-49f5-b8f7-07c4e07ee3d2.sql =====


CREATE TABLE IF NOT EXISTS public.push_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  url text,
  icon_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.push_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access push_templates" ON public.push_templates;
CREATE POLICY "Admins full access push_templates" ON public.push_templates
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));



-- ===== 20260303161600_admin_total_control.sql =====

-- Evolution of the system: Giving admins "Total Control"
-- This allows admins to perform any action on any table, which is necessary for the Impersonation feature.

-- 1. Update user_owns_loja helper to return true for admins
-- This automatically enables access to: empresas, envios, pedidos, postagem_templates, postagem_eventos, postagem_config, postagem_email_log, shopify_integrations, checkout_integrations, etc.
CREATE OR REPLACE FUNCTION public.user_owns_loja(_user_id UUID, _loja_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lojas
    WHERE id = _loja_id AND user_id = _user_id
  ) OR public.has_role(_user_id, 'admin');
$$;

-- 2. Grant full access to admins on 'profiles'
-- Dropping old select-only policy if it exists to avoid redundancy (though not strictly necessary as they are additive)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins full access profiles" ON public.profiles;
CREATE POLICY "Admins full access profiles" ON public.profiles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Grant full access to admins on 'lojas'
DROP POLICY IF EXISTS "Admins can view all lojas" ON public.lojas;
DROP POLICY IF EXISTS "Admins full access lojas" ON public.lojas;
CREATE POLICY "Admins full access lojas" ON public.lojas
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));



-- ===== 20260303170000_failed_delivery_config.sql =====

-- Migration para adicionar a funcionalidade "Falha na Entrega"
-- Adiciona colunas em postagem_config
ALTER TABLE public.postagem_config ADD COLUMN IF NOT EXISTS ativar_falha_entrega boolean NOT NULL DEFAULT false;
ALTER TABLE public.postagem_config ADD COLUMN IF NOT EXISTS msg_falha_entrega text;
ALTER TABLE public.postagem_config ADD COLUMN IF NOT EXISTS checkout_url_falha text;
ALTER TABLE public.postagem_config ADD COLUMN IF NOT EXISTS valor_taxa_falha numeric DEFAULT 0;

-- Adiciona o evento de "Falha na Entrega" aos templates de sistema existentes (Nacional Padrão e Nacional Taxação)
-- O status_label será 'Falha na Entrega'
-- A ordem ideal é 5.5, para ficar entre 'Saiu para Entrega' (5) e 'Entregue' (6).
-- Como a coluna ordem é integer, vamos precisar atualizar as ordens de Entregue (6 -> 7) e inserir Falha na Entrega como 6

DO $$
DECLARE
    template_padrao_id uuid := '00000000-0000-0000-0000-000000000001';
    template_taxacao_id uuid := '00000000-0000-0000-0000-000000000002';
BEGIN
    -- Atualiza Nacional Padrão
    -- Move Entregue de 6 para 7
    UPDATE public.postagem_eventos SET ordem = 7 WHERE template_id = template_padrao_id AND status_label = 'Entregue';
    
    -- Insere Falha na Entrega na ordem 6
    INSERT INTO public.postagem_eventos (template_id, nome, descricao, status_label, ordem, delay_horas, enviar_email, enviar_nfe_pdf, assunto_email, corpo_email, is_final) 
    VALUES (
        template_padrao_id, 
        'Falha na Entrega', 
        'Tentativa de entrega não sucedida. Aguardando pagamento de nova taxa de envio.', 
        'Falha Entrega', 
        6, 
        24, 
        true, 
        false, 
        '⚠️ Aviso de Falha na Entrega - {{produto}}', 
        '<p>Olá {{cliente_nome}},</p><p>Houve uma falha na tentativa de entrega do seu pedido <b>{{produto}}</b>.</p><p>Para reenviarmos, por favor pague a taxa de retentativa.</p>', 
        false
    ) ON CONFLICT DO NOTHING;

    -- Atualiza Nacional Taxação
    -- Taxação tem Saiu para Entrega = 7 e Entregue = 8
    -- Move Entregue de 8 para 9
    UPDATE public.postagem_eventos SET ordem = 9 WHERE template_id = template_taxacao_id AND status_label = 'Entregue';

    -- Insere Falha na Entrega na ordem 8
    INSERT INTO public.postagem_eventos (template_id, nome, descricao, status_label, ordem, delay_horas, enviar_email, enviar_nfe_pdf, assunto_email, corpo_email, is_final) 
    VALUES (
        template_taxacao_id, 
        'Falha na Entrega', 
        'Tentativa de entrega não sucedida. Aguardando pagamento de nova taxa de envio.', 
        'Falha Entrega', 
        8, 
        24, 
        true, 
        false, 
        '⚠️ Aviso de Falha na Entrega - {{produto}}', 
        '<p>Olá {{cliente_nome}},</p><p>Houve uma falha na tentativa de entrega do seu pedido <b>{{produto}}</b>.</p><p>Para reenviarmos, por favor pague a taxa de retentativa.</p>', 
        false
    ) ON CONFLICT DO NOTHING;
END $$;



-- ===== 20260303173000_failed_delivery_cost.sql =====

INSERT INTO public.system_config (key, value, label) VALUES ('custo_falha_entrega', 1.00, 'Custo Falha Entrega') ON CONFLICT (key) DO NOTHING;



-- ===== 20260304152258_701c9e7c-8bfb-4066-b171-3dcfd9094635.sql =====


ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, whatsapp)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email, NEW.raw_user_meta_data->>'whatsapp');
  RETURN NEW;
END;
$$;



-- ===== 20260304222008_60684bfe-3384-4a35-9af5-53f57d4c1f72.sql =====

DO $c$ BEGIN ALTER TABLE public.pix_payments 
ADD CONSTRAINT pix_payments_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $c$;

-- Consolidated schema migration

-- ===== 20260306181928_5539b570-a6e0-41ce-9dbb-208052da3157.sql =====

ALTER TABLE public.empresas ALTER COLUMN cnpj DROP NOT NULL;
ALTER TABLE public.empresas ALTER COLUMN razao_social DROP NOT NULL;
ALTER TABLE public.empresas ALTER COLUMN cnpj SET DEFAULT '';


-- ===== 20260306182606_6052d65d-3e42-417c-aa76-b20533cebde3.sql =====

ALTER TABLE public.postagem_config ADD COLUMN IF NOT EXISTS whatsapp_vendedor text DEFAULT NULL;


-- ===== 20260307032913_03efb9fe-0562-4484-930b-44c8d2d8adf9.sql =====


-- Add referral columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by uuid;

-- Trigger to auto-generate referral code on insert
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := upper(substr(md5(NEW.id::text || clock_timestamp()::text), 1, 8));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_referral_code ON public.profiles;
CREATE TRIGGER trg_generate_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.generate_referral_code();

-- Referral earnings table
CREATE TABLE IF NOT EXISTS public.referral_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referred_id uuid NOT NULL,
  pix_payment_id uuid NOT NULL,
  amount_earned numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_earnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own referral earnings" ON public.referral_earnings;
CREATE POLICY "Users view own referral earnings" ON public.referral_earnings
  FOR SELECT TO authenticated USING (auth.uid() = referrer_id);

DROP POLICY IF EXISTS "Service role manage referral_earnings" ON public.referral_earnings;
CREATE POLICY "Service role manage referral_earnings" ON public.referral_earnings
  FOR ALL USING (auth.role() = 'service_role'::text);



-- ===== 20260307032932_6f8ab021-181e-406e-a579-6a7a64ee3680.sql =====


CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _referrer_id uuid;
  _ref_code text;
BEGIN
  _ref_code := NEW.raw_user_meta_data->>'referral_code';

  IF _ref_code IS NOT NULL AND _ref_code != '' THEN
    SELECT id INTO _referrer_id FROM public.profiles WHERE referral_code = _ref_code;
  END IF;

  INSERT INTO public.profiles (id, full_name, email, whatsapp, referred_by)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    NEW.raw_user_meta_data->>'whatsapp',
    _referrer_id
  );
  RETURN NEW;
END;
$$;



-- ===== 20260307033728_fdc853cc-6ca7-4257-bea0-3d454e2ad0d5.sql =====

DO $$
DECLARE
  rec RECORD;
  falha_ordem INTEGER;
BEGIN
  FOR rec IN 
    SELECT DISTINCT template_id, ordem 
    FROM postagem_eventos 
    WHERE status_label = 'Falha Entrega'
  LOOP
    falha_ordem := rec.ordem;
    
    IF NOT EXISTS (
      SELECT 1 FROM postagem_eventos 
      WHERE template_id = rec.template_id AND status_label = 'Reenvio Pago'
    ) THEN
      UPDATE postagem_eventos 
      SET ordem = ordem + 2 
      WHERE template_id = rec.template_id 
        AND ordem > falha_ordem;
      
      INSERT INTO postagem_eventos (template_id, nome, status_label, ordem, delay_horas, enviar_email, enviar_nfe_pdf, is_final, descricao, assunto_email, corpo_email)
      VALUES (
        rec.template_id,
        'Reenvio Pago',
        'Reenvio Pago',
        falha_ordem + 1,
        24,
        true,
        false,
        false,
        'Pagamento do reenvio confirmado',
        'Reenvio confirmado! Seu pedido será reenviado - {{codigo_rastreio}}',
        'Ótima notícia! Recebemos o pagamento da taxa de reenvio do seu pedido **{{produto}}**.\n\nSeu pedido será preparado e reenviado em breve. Fique atento às próximas atualizações de rastreio.'
      );
      
      INSERT INTO postagem_eventos (template_id, nome, status_label, ordem, delay_horas, enviar_email, enviar_nfe_pdf, is_final, descricao, assunto_email, corpo_email)
      VALUES (
        rec.template_id,
        'Reenvio Saiu para Entrega',
        'Reenvio Saiu',
        falha_ordem + 2,
        24,
        true,
        false,
        false,
        'Pedido saiu novamente para entrega',
        'Seu pedido saiu para entrega novamente! - {{codigo_rastreio}}',
        'Seu pedido **{{produto}}** saiu novamente para entrega!\n\nDesta vez, certifique-se de que alguém estará no endereço para receber a encomenda.'
      );
    END IF;
  END LOOP;
END $$;


-- ===== 20260307101100_whatsapp_instances.sql =====

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

DROP POLICY IF EXISTS "Users can view their own whatsapp instances" ON public.whatsapp_instances;
CREATE POLICY "Users can view their own whatsapp instances" ON public.whatsapp_instances FOR SELECT
  USING (
    loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert their own whatsapp instances" ON public.whatsapp_instances;
CREATE POLICY "Users can insert their own whatsapp instances" ON public.whatsapp_instances FOR INSERT
  WITH CHECK (
    loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update their own whatsapp instances" ON public.whatsapp_instances;
CREATE POLICY "Users can update their own whatsapp instances" ON public.whatsapp_instances FOR UPDATE
  USING (
    loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete their own whatsapp instances" ON public.whatsapp_instances;
CREATE POLICY "Users can delete their own whatsapp instances" ON public.whatsapp_instances FOR DELETE
  USING (
    loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid())
  );



-- ===== 20260307133823_bfa3e2fe-51c2-4c68-acbe-dda87b5fa893.sql =====


ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_price NUMERIC DEFAULT 29.99;



-- ===== 20260307134854_19e95dac-a8b4-4bcf-ade0-4ab32a7161c7.sql =====


-- 1. Create whatsapp_message_log table
CREATE TABLE IF NOT EXISTS public.whatsapp_message_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  envio_id UUID REFERENCES public.envios(id) ON DELETE CASCADE NOT NULL,
  loja_id UUID REFERENCES public.lojas(id) ON DELETE CASCADE NOT NULL,
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_message_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own loja whatsapp_message_log" ON public.whatsapp_message_log;
CREATE POLICY "Users access own loja whatsapp_message_log" ON public.whatsapp_message_log FOR ALL TO authenticated
  USING (user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (user_owns_loja(auth.uid(), loja_id));

-- 2. Add auto-send columns to postagem_config
ALTER TABLE public.postagem_config
  ADD COLUMN IF NOT EXISTS whatsapp_auto_send BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_delay_seconds INTEGER DEFAULT 300;

-- 3. Remove unique constraint on whatsapp_instances(loja_id) to allow multiple instances
ALTER TABLE public.whatsapp_instances DROP CONSTRAINT IF EXISTS whatsapp_instances_loja_id_key;



-- ===== 20260307135911_d1bd47a9-a42f-42e7-86e8-0bea6db213a2.sql =====


ALTER TABLE public.postagem_config
  ADD COLUMN IF NOT EXISTS whatsapp_image_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_reply_text TEXT DEFAULT 'Quero acompanhar meu pedido';



-- ===== 20260307141154_b57bbff3-61ff-4083-a617-f269cc064ef6.sql =====


-- Create whatsapp_subscriptions table
CREATE TABLE IF NOT EXISTS public.whatsapp_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  price_paid NUMERIC NOT NULL DEFAULT 29.99,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add subscription_id to whatsapp_instances
ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES public.whatsapp_subscriptions(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.whatsapp_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS: users can access their own loja subscriptions
DROP POLICY IF EXISTS "Users access own loja whatsapp_subscriptions" ON public.whatsapp_subscriptions;
CREATE POLICY "Users access own loja whatsapp_subscriptions" ON public.whatsapp_subscriptions
  FOR ALL
  USING (user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (user_owns_loja(auth.uid(), loja_id));

-- RLS: admins full access
DROP POLICY IF EXISTS "Admins full access whatsapp_subscriptions" ON public.whatsapp_subscriptions;
CREATE POLICY "Admins full access whatsapp_subscriptions" ON public.whatsapp_subscriptions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));



-- ===== 20260307145626_16875ca3-b7c0-4e0e-9730-f8b5b4eac2d7.sql =====

ALTER TABLE postagem_config ADD COLUMN IF NOT EXISTS whatsapp_btn2_text text DEFAULT NULL;
ALTER TABLE postagem_config ADD COLUMN IF NOT EXISTS whatsapp_btn2_url text DEFAULT NULL;


-- ===== 20260307164947_c88330c1-9409-42dc-9173-39f18aa34cc5.sql =====


-- Allow admins to view all whatsapp instances
DROP POLICY IF EXISTS "Admins full access whatsapp_instances" ON public.whatsapp_instances;
CREATE POLICY "Admins full access whatsapp_instances" ON public.whatsapp_instances
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));



-- ===== 20260307183638_8d46e39c-bac8-4f3d-8095-675b87e78e0c.sql =====

ALTER TABLE postagem_email_log ALTER COLUMN custo SET DEFAULT 0.0021;


-- ===== 20260310084500_add_logistica_provider.sql =====

-- Migration to add logistica_provider to lojas table

ALTER TABLE public.lojas
ADD COLUMN IF NOT EXISTS logistica_provider TEXT NOT NULL DEFAULT 'jl';

COMMENT ON COLUMN public.lojas.logistica_provider IS 'jl ou jadlog';



-- ===== 20260310101800_add_postagem_template_id.sql =====

-- Adicionar coluna postagem_template_id à tabela envios
ALTER TABLE public.envios 
ADD COLUMN IF NOT EXISTS postagem_template_id UUID REFERENCES public.postagem_templates(id);

-- Opcional: Para manter integridade e facilitar visualização, você pode definir um comentário
COMMENT ON COLUMN public.envios.postagem_template_id IS 'ID do template de postagem ativo no momento da criação deste envio. Usado para travar o funil de eventos.';



-- ===== 20260310115954_2155782f-0ffd-46c1-9041-6d15673f21f5.sql =====

ALTER TABLE lojas ADD COLUMN IF NOT EXISTS logistica_provider TEXT DEFAULT 'jl';


-- ===== 20260310143020_c14dcc13-cce6-4892-84e3-5486cd2af1b7.sql =====


UPDATE envios e
SET postagem_template_id = pc.template_ativo_id
FROM postagem_config pc
WHERE e.loja_id = pc.loja_id
  AND e.postagem_template_id IS NULL
  AND pc.template_ativo_id IS NOT NULL;



-- ===== 20260310160054_611adcf6-ff33-42a2-882d-049bef5d4c58.sql =====

ALTER TABLE public.postagem_config
  ADD COLUMN IF NOT EXISTS cor_primaria text DEFAULT '#6366f1',
  ADD COLUMN IF NOT EXISTS cor_botao_cta text DEFAULT '#1a1a1a';


-- ===== 20260310164122_d8cc9b62-d47a-48ff-9026-80aa84146be5.sql =====

CREATE OR REPLACE FUNCTION public.generate_tracking_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
  provider TEXT;
  suffix TEXT;
BEGIN
  -- Determine provider from loja
  IF NEW.loja_id IS NOT NULL THEN
    SELECT logistica_provider INTO provider
    FROM lojas WHERE id = NEW.loja_id;
  END IF;

  suffix := CASE WHEN provider = 'jadlog' THEN 'JD' ELSE 'JL' END;

  -- Generate tracking code with correct suffix
  IF NEW.codigo_rastreio IS NULL OR NEW.codigo_rastreio = '' THEN
    LOOP
      new_code := 'BR' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10)) || suffix;
      SELECT EXISTS(SELECT 1 FROM envios WHERE codigo_rastreio = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    NEW.codigo_rastreio := new_code;
  END IF;

  -- Set transportadora if not provided
  IF NEW.transportadora IS NULL OR NEW.transportadora = '' THEN
    NEW.transportadora := CASE WHEN provider = 'jadlog' 
      THEN 'JADLOG Logística' 
      ELSE 'JL RASTREIOS' 
    END;
  END IF;

  RETURN NEW;
END;
$$;


-- ===== 20260313011849_034b16c4-02d9-4467-8cc3-f8200095737e.sql =====


CREATE TABLE IF NOT EXISTS public.batch_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  current_item integer NOT NULL DEFAULT 0,
  total_items integer NOT NULL DEFAULT 0,
  cancelled boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(loja_id)
);

ALTER TABLE public.batch_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own loja batch_progress" ON public.batch_progress;
CREATE POLICY "Users access own loja batch_progress" ON public.batch_progress
  FOR ALL
  USING (user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (user_owns_loja(auth.uid(), loja_id));

ALTER PUBLICATION supabase_realtime ADD TABLE public.batch_progress;



-- ===== 20260321133759_4ada8365-44ab-4d67-8b81-d81fd0a105e1.sql =====


-- Add resend_email_id and updated_at to postagem_email_log
ALTER TABLE public.postagem_email_log
  ADD COLUMN IF NOT EXISTS resend_email_id TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Index for webhook lookups by resend_email_id
CREATE INDEX IF NOT EXISTS idx_postagem_email_log_resend_email_id
  ON public.postagem_email_log (resend_email_id)
  WHERE resend_email_id IS NOT NULL;

-- Index for health dashboard queries (negative statuses)
CREATE INDEX IF NOT EXISTS idx_postagem_email_log_status
  ON public.postagem_email_log (status);

-- Allow service_role to update email logs (for webhook)
DROP POLICY IF EXISTS "Service role can manage email logs" ON public.postagem_email_log;
CREATE POLICY "Service role can manage email logs" ON public.postagem_email_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');



-- ===== 20260324175837_035b0a06-0608-4f94-8c84-7e35f462d6d9.sql =====

ALTER TABLE public.checkout_integrations ADD COLUMN IF NOT EXISTS filtro_metodo text NOT NULL DEFAULT 'todos';


-- ===== 20260324185229_39583817-b0ac-47c4-9bec-9444df34af81.sql =====

ALTER TABLE public.whatsapp_instances ADD COLUMN IF NOT EXISTS label text;

