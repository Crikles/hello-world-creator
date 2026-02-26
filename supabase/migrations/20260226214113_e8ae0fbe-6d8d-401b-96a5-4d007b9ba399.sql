
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
