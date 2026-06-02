ALTER TABLE public.creditos ALTER COLUMN saldo TYPE NUMERIC(10,2) USING saldo::numeric;
ALTER TABLE public.creditos_transacoes ALTER COLUMN quantidade TYPE NUMERIC(10,2) USING quantidade::numeric;

CREATE OR REPLACE FUNCTION public.debit_user_credits(_user_id uuid, _quantidade numeric, _descricao text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE current_saldo numeric;
BEGIN
  SELECT saldo INTO current_saldo FROM creditos WHERE user_id = _user_id FOR UPDATE;
  IF current_saldo IS NULL OR current_saldo < _quantidade THEN RETURN FALSE; END IF;
  UPDATE creditos SET saldo = saldo - _quantidade, updated_at = now() WHERE user_id = _user_id;
  INSERT INTO creditos_transacoes (user_id, tipo, quantidade, descricao)
  VALUES (_user_id, 'consumo', _quantidade, _descricao);
  RETURN TRUE;
END $function$;