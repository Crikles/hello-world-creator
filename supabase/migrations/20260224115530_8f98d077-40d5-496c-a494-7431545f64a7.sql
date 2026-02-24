
-- 1. Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 2. Create lojas table
CREATE TABLE public.lojas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lojas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lojas"
  ON public.lojas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lojas"
  ON public.lojas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lojas"
  ON public.lojas FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own lojas"
  ON public.lojas FOR DELETE
  USING (auth.uid() = user_id);

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
ALTER TABLE public.empresas ADD COLUMN loja_id UUID REFERENCES public.lojas(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Allow all access to empresas" ON public.empresas;

CREATE POLICY "Users access own loja empresas"
  ON public.empresas FOR ALL
  USING (public.user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (public.user_owns_loja(auth.uid(), loja_id));

-- envios: add loja_id, drop old policy, add new
ALTER TABLE public.envios ADD COLUMN loja_id UUID REFERENCES public.lojas(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Allow all access to envios" ON public.envios;

CREATE POLICY "Users access own loja envios"
  ON public.envios FOR ALL
  USING (public.user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (public.user_owns_loja(auth.uid(), loja_id));

-- pedidos: add loja_id
ALTER TABLE public.pedidos ADD COLUMN loja_id UUID REFERENCES public.lojas(id) ON DELETE CASCADE;

ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own loja pedidos"
  ON public.pedidos FOR ALL
  USING (public.user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (public.user_owns_loja(auth.uid(), loja_id));

-- webhook_logs: add loja_id
ALTER TABLE public.webhook_logs ADD COLUMN loja_id UUID REFERENCES public.lojas(id) ON DELETE CASCADE;

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own loja webhook_logs"
  ON public.webhook_logs FOR ALL
  USING (public.user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (public.user_owns_loja(auth.uid(), loja_id));

-- Indexes
CREATE INDEX idx_lojas_user_id ON public.lojas(user_id);
CREATE INDEX idx_lojas_slug ON public.lojas(slug);
CREATE INDEX idx_empresas_loja_id ON public.empresas(loja_id);
CREATE INDEX idx_envios_loja_id ON public.envios(loja_id);
CREATE INDEX idx_pedidos_loja_id ON public.pedidos(loja_id);
CREATE INDEX idx_webhook_logs_loja_id ON public.webhook_logs(loja_id);
