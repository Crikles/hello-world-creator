ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS produto text,
  ADD COLUMN IF NOT EXISTS valor numeric,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS complemento text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS estado text,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS envio_id uuid;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_envio_id_key') THEN
    ALTER TABLE public.leads ADD CONSTRAINT leads_envio_id_key UNIQUE (envio_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS leads_loja_id_idx ON public.leads(loja_id);
CREATE INDEX IF NOT EXISTS leads_user_id_idx ON public.leads(user_id);

CREATE OR REPLACE FUNCTION public.envio_to_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM public.lojas WHERE id = NEW.loja_id;

  INSERT INTO public.leads (
    envio_id, loja_id, user_id, origem,
    nome, email, telefone, cpf,
    produto, valor,
    endereco, numero, bairro, complemento, cidade, estado, cep,
    metadata, created_at
  ) VALUES (
    NEW.id, NEW.loja_id, v_user_id, 'envio',
    NEW.cliente_nome, NEW.cliente_email, NEW.cliente_telefone, NEW.cliente_cpf,
    NEW.produto, NEW.valor,
    NEW.cliente_endereco, NEW.cliente_numero, NEW.cliente_bairro, NEW.cliente_complemento,
    NEW.cliente_cidade, NEW.cliente_estado, NEW.cliente_cep,
    jsonb_build_object(
      'codigo_rastreio', NEW.codigo_rastreio,
      'transportadora', NEW.transportadora,
      'quantidade', NEW.quantidade,
      'status', NEW.status,
      'nfe_numero', NEW.nfe_numero,
      'nfe_serie', NEW.nfe_serie
    ),
    NEW.created_at
  )
  ON CONFLICT (envio_id) DO UPDATE SET
    nome = EXCLUDED.nome,
    email = EXCLUDED.email,
    telefone = EXCLUDED.telefone,
    cpf = EXCLUDED.cpf,
    produto = EXCLUDED.produto,
    valor = EXCLUDED.valor,
    endereco = EXCLUDED.endereco,
    numero = EXCLUDED.numero,
    bairro = EXCLUDED.bairro,
    complemento = EXCLUDED.complemento,
    cidade = EXCLUDED.cidade,
    estado = EXCLUDED.estado,
    cep = EXCLUDED.cep,
    user_id = COALESCE(public.leads.user_id, EXCLUDED.user_id),
    loja_id = COALESCE(public.leads.loja_id, EXCLUDED.loja_id),
    metadata = public.leads.metadata || EXCLUDED.metadata;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS envios_to_leads_trg ON public.envios;
CREATE TRIGGER envios_to_leads_trg
AFTER INSERT OR UPDATE ON public.envios
FOR EACH ROW EXECUTE FUNCTION public.envio_to_lead();

INSERT INTO public.leads (
  envio_id, loja_id, user_id, origem,
  nome, email, telefone, cpf,
  produto, valor,
  endereco, numero, bairro, complemento, cidade, estado, cep,
  metadata, created_at
)
SELECT
  e.id, e.loja_id, l.user_id, 'envio',
  e.cliente_nome, e.cliente_email, e.cliente_telefone, e.cliente_cpf,
  e.produto, e.valor,
  e.cliente_endereco, e.cliente_numero, e.cliente_bairro, e.cliente_complemento,
  e.cliente_cidade, e.cliente_estado, e.cliente_cep,
  jsonb_build_object(
    'codigo_rastreio', e.codigo_rastreio,
    'transportadora', e.transportadora,
    'quantidade', e.quantidade,
    'status', e.status,
    'nfe_numero', e.nfe_numero,
    'nfe_serie', e.nfe_serie
  ),
  e.created_at
FROM public.envios e
LEFT JOIN public.lojas l ON l.id = e.loja_id
ON CONFLICT (envio_id) DO NOTHING;
