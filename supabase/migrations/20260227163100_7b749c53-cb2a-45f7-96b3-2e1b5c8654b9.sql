
-- Tabela leads
CREATE TABLE public.leads (
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

CREATE POLICY "Admins full access leads"
  ON public.leads FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Indice unico parcial para upsert
CREATE UNIQUE INDEX leads_envio_id_unique ON public.leads (envio_id) WHERE envio_id IS NOT NULL;

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
CREATE TRIGGER on_envio_capture_lead
  AFTER INSERT OR UPDATE ON public.envios
  FOR EACH ROW EXECUTE FUNCTION capture_lead_from_envio();
