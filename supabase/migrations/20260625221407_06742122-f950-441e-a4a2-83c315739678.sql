
ALTER TABLE public.creditos_transacoes DROP CONSTRAINT IF EXISTS creditos_transacoes_tipo_check;
ALTER TABLE public.creditos_transacoes ADD CONSTRAINT creditos_transacoes_tipo_check
  CHECK (tipo IN ('consumo','deposito','recarga','adicao','estorno','bonus','cashback','ajuste'));

CREATE OR REPLACE FUNCTION public.refund_user_credits(_user_id uuid, _quantidade numeric, _descricao text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE creditos SET saldo = saldo + _quantidade, updated_at = now() WHERE user_id = _user_id;
  INSERT INTO creditos_transacoes (user_id, tipo, quantidade, descricao)
  VALUES (_user_id, 'estorno', _quantidade, _descricao);
  RETURN TRUE;
END $$;

SELECT public.refund_user_credits(
  'c43b07fa-f1db-4dfa-9b9e-dde4cc139fdc'::uuid,
  109.50,
  'Estorno corretivo: 73 débitos sem avanço de envio (refund_user_credits ausente)'
);
