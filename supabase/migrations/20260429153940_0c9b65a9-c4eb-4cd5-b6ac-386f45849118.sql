CREATE OR REPLACE FUNCTION public.refund_user_credits(_user_id uuid, _quantidade numeric, _descricao text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_saldo NUMERIC;
BEGIN
  IF _quantidade <= 0 THEN
    RETURN FALSE;
  END IF;

  SELECT saldo INTO current_saldo
  FROM creditos WHERE user_id = _user_id FOR UPDATE;

  IF current_saldo IS NULL THEN
    INSERT INTO creditos (user_id, saldo) VALUES (_user_id, _quantidade);
  ELSE
    UPDATE creditos
    SET saldo = saldo + _quantidade, updated_at = now()
    WHERE user_id = _user_id;
  END IF;

  INSERT INTO creditos_transacoes (user_id, tipo, quantidade, descricao)
  VALUES (_user_id, 'estorno', _quantidade, _descricao);

  RETURN TRUE;
END;
$function$;