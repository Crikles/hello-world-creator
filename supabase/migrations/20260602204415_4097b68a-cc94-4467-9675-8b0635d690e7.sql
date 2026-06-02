-- 1) Add missing columns to recovery_leads (used by all webhooks + send-recovery-email/sms)
ALTER TABLE public.recovery_leads
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_email text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS products jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS total_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checkout_url text,
  ADD COLUMN IF NOT EXISTS pix_code text,
  ADD COLUMN IF NOT EXISTS pix_qrcode_url text,
  ADD COLUMN IF NOT EXISTS raw_payload jsonb;

-- Backfill from legacy columns if present
UPDATE public.recovery_leads
SET customer_name  = COALESCE(customer_name, nome),
    customer_email = COALESCE(customer_email, email),
    customer_phone = COALESCE(customer_phone, telefone),
    total_value    = COALESCE(total_value, valor, 0)
WHERE customer_name IS NULL OR customer_email IS NULL OR customer_phone IS NULL;

-- Unique index for race-safe dedupe on orderId (used by webhook-zedy, etc.)
CREATE UNIQUE INDEX IF NOT EXISTS recovery_leads_loja_orderid_uidx
  ON public.recovery_leads (loja_id, ((raw_payload->>'orderId')))
  WHERE raw_payload ? 'orderId';

CREATE INDEX IF NOT EXISTS recovery_leads_loja_email_tipo_idx
  ON public.recovery_leads (loja_id, customer_email, tipo, created_at DESC);

-- 2) RPC: try_create_envio_dedupe — atomic envio insert protected by advisory lock
CREATE OR REPLACE FUNCTION public.try_create_envio_dedupe(
  _loja_id uuid,
  _cliente_email text,
  _valor numeric,
  _envio_data jsonb
)
RETURNS TABLE(envio_id uuid, was_duplicate boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lock_key bigint;
  v_existing_id uuid;
  v_new_id uuid;
BEGIN
  -- Advisory lock keyed by loja+email+valor, serializes concurrent webhooks for same order
  v_lock_key := abs(hashtextextended(_loja_id::text || '|' || coalesce(_cliente_email,'') || '|' || coalesce(_valor::text,''), 0));
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Check for recent duplicate (same loja+email+valor in last 10 min)
  SELECT e.id INTO v_existing_id
  FROM public.envios e
  WHERE e.loja_id = _loja_id
    AND e.cliente_email = _cliente_email
    AND e.valor = _valor
    AND e.deleted_at IS NULL
    AND e.created_at > now() - interval '10 minutes'
  ORDER BY e.created_at DESC
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN QUERY SELECT v_existing_id, true;
    RETURN;
  END IF;

  -- Insert new envio from jsonb
  INSERT INTO public.envios (
    cliente_nome, cliente_email, cliente_cpf, cliente_telefone,
    cliente_endereco, cliente_numero, cliente_bairro, cliente_cep,
    cliente_cidade, cliente_estado, cliente_complemento,
    produto, quantidade, valor, status, loja_id, empresa_id
  )
  VALUES (
    _envio_data->>'cliente_nome',
    _envio_data->>'cliente_email',
    _envio_data->>'cliente_cpf',
    _envio_data->>'cliente_telefone',
    _envio_data->>'cliente_endereco',
    _envio_data->>'cliente_numero',
    _envio_data->>'cliente_bairro',
    _envio_data->>'cliente_cep',
    _envio_data->>'cliente_cidade',
    _envio_data->>'cliente_estado',
    _envio_data->>'cliente_complemento',
    COALESCE(_envio_data->>'produto', 'Produto'),
    COALESCE((_envio_data->>'quantidade')::int, 1),
    COALESCE((_envio_data->>'valor')::numeric, _valor),
    COALESCE((_envio_data->>'status')::shipment_status, 'pendente'::shipment_status),
    _loja_id,
    NULLIF(_envio_data->>'empresa_id','')::uuid
  )
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT v_new_id, false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.try_create_envio_dedupe(uuid, text, numeric, jsonb) TO service_role;