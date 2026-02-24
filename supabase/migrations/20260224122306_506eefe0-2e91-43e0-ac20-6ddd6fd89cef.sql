
-- Tabela creditos (saldo por usuario)
CREATE TABLE public.creditos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  saldo INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.creditos ENABLE ROW LEVEL SECURITY;

-- Tabela creditos_transacoes (historico)
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

-- RLS creditos
CREATE POLICY "Users view own credits" ON public.creditos
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins full access credits" ON public.creditos
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS creditos_transacoes
CREATE POLICY "Users view own transactions" ON public.creditos_transacoes
  FOR SELECT USING (auth.uid() = user_id);
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
CREATE TRIGGER on_auth_user_created_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_user_credits();

-- Criar saldo para usuarios existentes que ainda nao tem
INSERT INTO public.creditos (user_id, saldo)
SELECT id, 0 FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.creditos);

-- Admin precisa ler todos os profiles e lojas e envios
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view all lojas" ON public.lojas
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view all envios" ON public.envios
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
