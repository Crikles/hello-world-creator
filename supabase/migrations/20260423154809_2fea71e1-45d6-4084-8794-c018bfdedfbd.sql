
CREATE OR REPLACE FUNCTION public.try_create_envio_dedupe(
  _loja_id uuid,
  _cliente_email text,
  _valor numeric,
  _envio_data jsonb
)
RETURNS TABLE(envio_id uuid, codigo_rastreio text, was_duplicate boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lock_key bigint;
  _existing_id uuid;
  _existing_codigo text;
  _new_id uuid;
  _new_codigo text;
  _one_hour_ago timestamptz := now() - interval '1 hour';
BEGIN
  -- Build a deterministic 64-bit lock key from (loja + email + valor)
  -- Uses hashtextextended which returns bigint; combines with valor cents to differentiate
  _lock_key := hashtextextended(
    _loja_id::text || '|' || lower(coalesce(_cliente_email, '')) || '|' || coalesce(_valor::text, '0'),
    42
  );

  -- Acquire transaction-scoped advisory lock; serializes concurrent inserts with same key
  PERFORM pg_advisory_xact_lock(_lock_key);

  -- Check for recent duplicate (same loja + email + valor in last 1h, not deleted)
  SELECT e.id, e.codigo_rastreio
  INTO _existing_id, _existing_codigo
  FROM public.envios e
  WHERE e.loja_id = _loja_id
    AND e.cliente_email = _cliente_email
    AND e.valor = _valor
    AND e.deleted_at IS NULL
    AND e.created_at >= _one_hour_ago
  ORDER BY e.created_at DESC
  LIMIT 1;

  IF _existing_id IS NOT NULL THEN
    RETURN QUERY SELECT _existing_id, _existing_codigo, true;
    RETURN;
  END IF;

  -- No duplicate found — insert the new envio from the JSON payload
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
    _envio_data->>'produto',
    COALESCE((_envio_data->>'quantidade')::int, 1),
    COALESCE((_envio_data->>'valor')::numeric, 0),
    COALESCE((_envio_data->>'status')::shipment_status, 'pendente'::shipment_status),
    _loja_id,
    NULLIF(_envio_data->>'empresa_id', '')::uuid
  )
  RETURNING id, codigo_rastreio INTO _new_id, _new_codigo;

  RETURN QUERY SELECT _new_id, _new_codigo, false;
END;
$$;
