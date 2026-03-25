
-- 1. Create cashback_log table
CREATE TABLE public.cashback_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  envio_id uuid NOT NULL UNIQUE,
  loja_id uuid NOT NULL,
  user_id uuid NOT NULL,
  valor_devolvido numeric NOT NULL DEFAULT 0,
  motivo text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.cashback_log ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies
CREATE POLICY "Admins full access cashback_log"
  ON public.cashback_log FOR ALL
  TO public
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own cashback_log"
  ON public.cashback_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manage cashback_log"
  ON public.cashback_log FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 4. Create process_cashback function
CREATE OR REPLACE FUNCTION public.process_cashback(_envio_id uuid, _user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _delivered_count integer;
  _already_exists boolean;
  _loja_id uuid;
  _valor_total numeric := 0;
  _custo_email numeric := 0;
  _custo_taxacao numeric := 0;
  _custo_falha numeric := 0;
  _custo_nfe numeric := 0;
  _config record;
  _custom_prices jsonb;
BEGIN
  -- Check if cashback already processed for this envio
  SELECT EXISTS(SELECT 1 FROM cashback_log WHERE envio_id = _envio_id) INTO _already_exists;
  IF _already_exists THEN
    RETURN 0;
  END IF;

  -- Get loja_id from envio
  SELECT loja_id INTO _loja_id FROM envios WHERE id = _envio_id;
  IF _loja_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Check if any email was successfully delivered
  SELECT count(*) INTO _delivered_count
  FROM postagem_email_log
  WHERE envio_id = _envio_id
    AND status IN ('delivered', 'opened', 'clicked');

  -- If at least one email was delivered, no cashback
  IF _delivered_count > 0 THEN
    RETURN 0;
  END IF;

  -- Check if there were any email attempts at all
  IF NOT EXISTS(SELECT 1 FROM postagem_email_log WHERE envio_id = _envio_id) THEN
    RETURN 0;
  END IF;

  -- Fetch config to know which services were active
  SELECT * INTO _config FROM postagem_config WHERE loja_id = _loja_id;
  IF _config IS NULL THEN
    RETURN 0;
  END IF;

  -- Fetch custom prices
  SELECT COALESCE(custom_prices, '{}'::jsonb) INTO _custom_prices
  FROM profiles WHERE id = _user_id;

  -- Calculate refund based on active services (same logic as debit)
  IF _config.enviar_nfe_email THEN
    SELECT COALESCE(
      (_custom_prices->>'custo_nfe_email')::numeric,
      (SELECT value FROM system_config WHERE key = 'custo_nfe_email')
    ) INTO _custo_nfe;
    _valor_total := _valor_total + COALESCE(_custo_nfe, 0);
  END IF;

  IF _config.enviar_emails THEN
    SELECT COALESCE(
      (_custom_prices->>'custo_email_rastreio')::numeric,
      (SELECT value FROM system_config WHERE key = 'custo_email_rastreio')
    ) INTO _custo_email;
    _valor_total := _valor_total + COALESCE(_custo_email, 0);
  END IF;

  IF _config.ativar_taxacao THEN
    SELECT COALESCE(
      (_custom_prices->>'custo_taxacao')::numeric,
      (SELECT value FROM system_config WHERE key = 'custo_taxacao')
    ) INTO _custo_taxacao;
    _valor_total := _valor_total + COALESCE(_custo_taxacao, 0);
  END IF;

  IF _config.ativar_falha_entrega THEN
    SELECT COALESCE(
      (_custom_prices->>'custo_falha_entrega')::numeric,
      (SELECT value FROM system_config WHERE key = 'custo_falha_entrega')
    ) INTO _custo_falha;
    _valor_total := _valor_total + COALESCE(_custo_falha, 0);
  END IF;

  -- If nothing to refund, skip
  IF _valor_total <= 0 THEN
    RETURN 0;
  END IF;

  -- Credit back
  UPDATE creditos SET saldo = saldo + _valor_total, updated_at = now()
  WHERE user_id = _user_id;

  -- Log the transaction
  INSERT INTO creditos_transacoes (user_id, tipo, quantidade, descricao)
  VALUES (_user_id, 'adicao', _valor_total, 'Cashback - emails não entregues (envio ' || _envio_id || ')');

  -- Log the cashback
  INSERT INTO cashback_log (envio_id, loja_id, user_id, valor_devolvido, motivo)
  VALUES (_envio_id, _loja_id, _user_id, _valor_total, 'Nenhum email entregue ao destinatário');

  RETURN _valor_total;
END;
$$;
