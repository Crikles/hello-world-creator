
-- Add status column to cashback_log
ALTER TABLE public.cashback_log ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente';
ALTER TABLE public.cashback_log ADD COLUMN IF NOT EXISTS approved_by uuid;
ALTER TABLE public.cashback_log ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone;

-- Replace process_cashback to only FLAG eligibility (no auto-credit)
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

  -- Just flag as pending with fixed value 0.50
  INSERT INTO cashback_log (envio_id, loja_id, user_id, valor_devolvido, motivo, status)
  VALUES (_envio_id, _loja_id, _user_id, 0.50, 'Nenhum email entregue ao destinatário', 'pendente');

  RETURN 0.50;
END;
$$;

-- Create approve_cashback function for admin use
CREATE OR REPLACE FUNCTION public.approve_cashback(_cashback_id uuid, _admin_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _cb record;
BEGIN
  SELECT * INTO _cb FROM cashback_log WHERE id = _cashback_id AND status = 'pendente';
  IF _cb IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Credit back 0.50
  UPDATE creditos SET saldo = saldo + 0.50, updated_at = now()
  WHERE user_id = _cb.user_id;

  -- Log the transaction
  INSERT INTO creditos_transacoes (user_id, tipo, quantidade, descricao, admin_id)
  VALUES (_cb.user_id, 'adicao', 0.50, 'Cashback aprovado - emails não entregues', _admin_id);

  -- Mark as approved
  UPDATE cashback_log SET status = 'aprovado', approved_by = _admin_id, approved_at = now()
  WHERE id = _cashback_id;

  RETURN TRUE;
END;
$$;

-- Create reject_cashback function
CREATE OR REPLACE FUNCTION public.reject_cashback(_cashback_id uuid, _admin_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE cashback_log SET status = 'rejeitado', approved_by = _admin_id, approved_at = now()
  WHERE id = _cashback_id AND status = 'pendente';
  
  RETURN FOUND;
END;
$$;
