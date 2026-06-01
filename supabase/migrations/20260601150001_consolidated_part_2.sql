-- Consolidated schema migration

-- ===== 20260324190932_e71de542-5f96-47f9-a5c5-f0d830b0147a.sql =====

CREATE TABLE IF NOT EXISTS public.whatsapp_send_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  envio_id uuid NOT NULL REFERENCES envios(id) ON DELETE CASCADE,
  instance_id uuid REFERENCES whatsapp_instances(id) ON DELETE SET NULL,
  number text NOT NULL,
  msg_text text NOT NULL,
  choices jsonb DEFAULT '[]'::jsonb,
  image_url text,
  footer_text text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE public.whatsapp_send_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own loja whatsapp_send_queue" ON public.whatsapp_send_queue;
CREATE POLICY "Users access own loja whatsapp_send_queue" ON public.whatsapp_send_queue
  FOR ALL
  TO authenticated
  USING (user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (user_owns_loja(auth.uid(), loja_id));

CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_pending ON public.whatsapp_send_queue (status, scheduled_at) WHERE status = 'pending';


-- ===== 20260324195231_849d2371-045d-4590-bc0d-deba7433f8a0.sql =====


CREATE OR REPLACE FUNCTION generate_tracking_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
  provider TEXT;
  suffix TEXT;
BEGIN
  -- Determine provider from loja
  IF NEW.loja_id IS NOT NULL THEN
    SELECT logistica_provider INTO provider
    FROM lojas WHERE id = NEW.loja_id;
  END IF;

  suffix := CASE
    WHEN provider = 'jadlog' THEN 'JD'
    WHEN provider = 'vetor' THEN 'VT'
    ELSE 'JL'
  END;

  -- Generate tracking code with correct suffix
  IF NEW.codigo_rastreio IS NULL OR NEW.codigo_rastreio = '' THEN
    LOOP
      new_code := 'BR' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10)) || suffix;
      SELECT EXISTS(SELECT 1 FROM envios WHERE codigo_rastreio = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    NEW.codigo_rastreio := new_code;
  END IF;

  -- Set transportadora if not provided
  IF NEW.transportadora IS NULL OR NEW.transportadora = '' THEN
    NEW.transportadora := CASE
      WHEN provider = 'jadlog' THEN 'JADLOG Logística'
      WHEN provider = 'vetor' THEN 'VETOR Transportes'
      ELSE 'JL RASTREIOS'
    END;
  END IF;

  RETURN NEW;
END;
$$;



-- ===== 20260325012159_40a009d4-a784-447a-892a-d8fa5c22e55c.sql =====


-- 1. Create cashback_log table
CREATE TABLE IF NOT EXISTS public.cashback_log (
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
DROP POLICY IF EXISTS "Admins full access cashback_log" ON public.cashback_log;
CREATE POLICY "Admins full access cashback_log" ON public.cashback_log FOR ALL
  TO public
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users view own cashback_log" ON public.cashback_log;
CREATE POLICY "Users view own cashback_log" ON public.cashback_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manage cashback_log" ON public.cashback_log;
CREATE POLICY "Service role manage cashback_log" ON public.cashback_log FOR ALL
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



-- ===== 20260325012456_951f811f-0357-4895-976d-94d3491afb88.sql =====


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



-- ===== 20260325145750_6a2770dc-4bd4-4513-a07a-896dfc0e9cde.sql =====

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _referrer_id uuid;
  _ref_code text;
  _clean_name text;
BEGIN
  _ref_code := NEW.raw_user_meta_data->>'referral_code';

  IF _ref_code IS NOT NULL AND _ref_code != '' THEN
    SELECT id INTO _referrer_id FROM public.profiles WHERE referral_code = _ref_code;
  END IF;

  -- Sanitize full_name: strip any HTML tags
  _clean_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  _clean_name := regexp_replace(_clean_name, '<[^>]*>', '', 'g');
  _clean_name := left(trim(_clean_name), 60);

  INSERT INTO public.profiles (id, full_name, email, whatsapp, referred_by)
  VALUES (
    NEW.id,
    _clean_name,
    NEW.email,
    NEW.raw_user_meta_data->>'whatsapp',
    _referrer_id
  );
  RETURN NEW;
END;
$function$;


-- ===== 20260325150838_f33b9a09-7428-4f36-8fa4-5970f2860b91.sql =====


CREATE TABLE IF NOT EXISTS public.signup_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  email text NOT NULL,
  full_name text NOT NULL,
  code text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  verified_at timestamptz,
  approved_by uuid
);

ALTER TABLE public.signup_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access signup_verifications" ON public.signup_verifications;
CREATE POLICY "Admins full access signup_verifications" ON public.signup_verifications FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Service role full access signup_verifications" ON public.signup_verifications;
CREATE POLICY "Service role full access signup_verifications" ON public.signup_verifications FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');



-- ===== 20260325153733_2cd81b36-7b72-4b31-aa9a-85fff00843b0.sql =====

ALTER TABLE public.system_config ADD COLUMN IF NOT EXISTS text_value text;


-- ===== 20260325171024_39e182ec-b869-4f97-8d46-ef8fb59d12c7.sql =====

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_verified boolean NOT NULL DEFAULT false;

-- Backfill: mark existing verified users
UPDATE public.profiles p
SET whatsapp_verified = true
WHERE EXISTS (
  SELECT 1 FROM public.signup_verifications sv
  WHERE sv.status = 'verificado'
  AND (
    regexp_replace(sv.phone, '\D', '', 'g') = regexp_replace(COALESCE(p.whatsapp, ''), '\D', '', 'g')
    OR lower(trim(sv.email)) = lower(trim(COALESCE(p.email, '')))
  )
  AND regexp_replace(COALESCE(p.whatsapp, ''), '\D', '', 'g') != ''
);


-- ===== 20260325171715_f8bf6930-b1f1-4186-bae0-d76dcc616dab.sql =====

-- 1. Update handle_new_user trigger to auto-set whatsapp_verified for new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _referrer_id uuid;
  _ref_code text;
  _clean_name text;
  _phone text;
  _email text;
  _is_verified boolean;
BEGIN
  _ref_code := NEW.raw_user_meta_data->>'referral_code';

  IF _ref_code IS NOT NULL AND _ref_code != '' THEN
    SELECT id INTO _referrer_id FROM public.profiles WHERE referral_code = _ref_code;
  END IF;

  -- Sanitize full_name: strip any HTML tags
  _clean_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  _clean_name := regexp_replace(_clean_name, '<[^>]*>', '', 'g');
  _clean_name := left(trim(_clean_name), 60);

  -- Check if this user already verified during signup
  _phone := regexp_replace(COALESCE(NEW.raw_user_meta_data->>'whatsapp', ''), '\D', '', 'g');
  _email := lower(trim(COALESCE(NEW.email, '')));

  _is_verified := EXISTS (
    SELECT 1 FROM public.signup_verifications sv
    WHERE sv.status = 'verificado'
    AND (
      (_phone != '' AND regexp_replace(sv.phone, '\D', '', 'g') = _phone)
      OR (_email != '' AND lower(trim(sv.email)) = _email)
    )
  );

  INSERT INTO public.profiles (id, full_name, email, whatsapp, referred_by, whatsapp_verified)
  VALUES (
    NEW.id,
    _clean_name,
    NEW.email,
    NEW.raw_user_meta_data->>'whatsapp',
    _referrer_id,
    _is_verified
  );
  RETURN NEW;
END;
$function$;

-- 2. Re-run backfill with broader matching (email OR phone)
UPDATE public.profiles p
SET whatsapp_verified = true
WHERE whatsapp_verified = false
AND EXISTS (
  SELECT 1 FROM public.signup_verifications sv
  WHERE sv.status = 'verificado'
  AND (
    (regexp_replace(COALESCE(p.whatsapp, ''), '\D', '', 'g') != '' AND regexp_replace(sv.phone, '\D', '', 'g') = regexp_replace(p.whatsapp, '\D', '', 'g'))
    OR (COALESCE(p.email, '') != '' AND lower(trim(sv.email)) = lower(trim(p.email)))
  )
);


-- ===== 20260325204825_3df71a62-aa06-405a-a448-f40bf5a6256c.sql =====

CREATE OR REPLACE FUNCTION public.generate_tracking_code()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
  provider TEXT;
  suffix TEXT;
BEGIN
  -- Determine provider from loja
  IF NEW.loja_id IS NOT NULL THEN
    SELECT logistica_provider INTO provider
    FROM lojas WHERE id = NEW.loja_id;
  END IF;

  -- JADLOG removed: fallback to VETOR
  suffix := CASE
    WHEN provider = 'vetor' OR provider = 'jadlog' THEN 'VT'
    ELSE 'JL'
  END;

  -- Generate tracking code with correct suffix
  IF NEW.codigo_rastreio IS NULL OR NEW.codigo_rastreio = '' THEN
    LOOP
      new_code := 'BR' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10)) || suffix;
      SELECT EXISTS(SELECT 1 FROM envios WHERE codigo_rastreio = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    NEW.codigo_rastreio := new_code;
  END IF;

  -- Set transportadora if not provided
  IF NEW.transportadora IS NULL OR NEW.transportadora = '' THEN
    NEW.transportadora := CASE
      WHEN provider = 'vetor' OR provider = 'jadlog' THEN 'VETOR Transportes'
      ELSE 'JL RASTREIOS'
    END;
  END IF;

  RETURN NEW;
END;
$function$;


-- ===== 20260325205836_406f9914-db43-43df-bd67-238f438fd0ba.sql =====

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS admin_tag text DEFAULT NULL;


-- ===== 20260326190710_a3d624e0-1612-46a1-997f-71d9c6908870.sql =====

ALTER TABLE postagem_config ADD COLUMN IF NOT EXISTS ativar_vizinho boolean NOT NULL DEFAULT true;


-- ===== 20260326194157_dd3b9e9f-a02a-4e2c-94e0-3fe28bffee00.sql =====


ALTER TABLE public.whatsapp_message_log 
  ADD COLUMN IF NOT EXISTS error_reason text,
  ADD COLUMN IF NOT EXISTS provider_response jsonb,
  ADD COLUMN IF NOT EXISTS http_status integer;

ALTER TABLE public.whatsapp_send_queue 
  ADD COLUMN IF NOT EXISTS error_reason text,
  ADD COLUMN IF NOT EXISTS provider_response jsonb,
  ADD COLUMN IF NOT EXISTS http_status integer,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;



-- ===== 20260327112939_a34cc613-4beb-41db-9692-28d75f8ca942.sql =====


-- Tabela de configuração de upsell por loja e tipo de email
CREATE TABLE IF NOT EXISTS public.upsell_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('nfe', 'coletado')),
  ativo boolean NOT NULL DEFAULT false,
  headline text DEFAULT 'Aproveite esta oferta especial!',
  sub_headline text DEFAULT 'Produto selecionado para você',
  produto_nome text DEFAULT '',
  produto_descricao text DEFAULT '',
  produto_valor text DEFAULT 'R$ 0,00',
  produto_imagem_url text DEFAULT '',
  botao_texto text DEFAULT 'Comprar Agora',
  botao_url text DEFAULT '',
  cor_headline text DEFAULT '#1e293b',
  cor_sub_headline text DEFAULT '#64748b',
  cor_nome_produto text DEFAULT '#0f172a',
  cor_descricao text DEFAULT '#475569',
  cor_valor text DEFAULT '#16a34a',
  cor_botao_bg text DEFAULT '#6366f1',
  cor_botao_texto text DEFAULT '#ffffff',
  cor_fundo text DEFAULT '#f8fafc',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (loja_id, tipo)
);

ALTER TABLE public.upsell_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own loja upsell_config" ON public.upsell_config;
CREATE POLICY "Users access own loja upsell_config" ON public.upsell_config
  FOR ALL
  TO authenticated
  USING (public.user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (public.user_owns_loja(auth.uid(), loja_id));

-- Custo do upsell na system_config
INSERT INTO public.system_config (key, value, label)
VALUES ('custo_upsell_email', 0.10, 'Custo por e-mail com upsell (moedas)')
ON CONFLICT (key) DO NOTHING;



-- ===== 20260328124509_704dd90c-6678-4abc-a3de-bc2950bd472e.sql =====


CREATE TABLE IF NOT EXISTS public.admin_cashback_processed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  total_clients integer NOT NULL DEFAULT 0,
  total_cashback numeric NOT NULL DEFAULT 0,
  period_start timestamp with time zone NOT NULL,
  period_end timestamp with time zone NOT NULL,
  processed_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_by uuid NOT NULL,
  destinatarios jsonb NOT NULL DEFAULT '[]'::jsonb
);

ALTER TABLE public.admin_cashback_processed ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access admin_cashback_processed" ON public.admin_cashback_processed;
CREATE POLICY "Admins full access admin_cashback_processed" ON public.admin_cashback_processed
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));



-- ===== 20260328223445_2a994674-440b-438b-be93-aa28ff897762.sql =====


CREATE TABLE IF NOT EXISTS public.admin_payment_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  label text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_payment_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access admin_payment_webhooks" ON public.admin_payment_webhooks;
CREATE POLICY "Admins full access admin_payment_webhooks" ON public.admin_payment_webhooks
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Service role full access admin_payment_webhooks" ON public.admin_payment_webhooks;
CREATE POLICY "Service role full access admin_payment_webhooks" ON public.admin_payment_webhooks
  FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

INSERT INTO public.admin_payment_webhooks (url, label) VALUES
  ('https://api.pushcut.io/cnofVRbcHtpDYX8uuBjpi/notifications/Recarga%20Magnus', 'PushCut Magnus'),
  ('https://api.pushcut.io/nvQPVRoZkrDRY_bb1oBXq/notifications/MinhaNotifica%C3%A7%C3%A3o1', 'PushCut Notificação');



-- ===== 20260401200251_187b78b8-40bb-47b9-b557-160bfc6227b4.sql =====


-- Recovery config per store
CREATE TABLE IF NOT EXISTS public.recovery_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT false,
  delay_minutos integer NOT NULL DEFAULT 30,
  assunto_email text NOT NULL DEFAULT '{{nome_cliente}}, você esqueceu algo 👀',
  corpo_email text NOT NULL DEFAULT '',
  enviar_sms boolean NOT NULL DEFAULT false,
  sms_template text DEFAULT '',
  cupom_ativo boolean NOT NULL DEFAULT false,
  codigo_cupom text DEFAULT '',
  descricao_cupom text DEFAULT '',
  beneficio_principal text DEFAULT '',
  beneficio_1 text DEFAULT '',
  beneficio_2 text DEFAULT '',
  beneficio_3 text DEFAULT '',
  garantia text DEFAULT '',
  ps_reforco_urgencia text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(loja_id)
);

ALTER TABLE public.recovery_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own loja recovery_config" ON public.recovery_config;
CREATE POLICY "Users access own loja recovery_config" ON public.recovery_config FOR ALL
  USING (user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (user_owns_loja(auth.uid(), loja_id));

DROP POLICY IF EXISTS "Service role full access recovery_config" ON public.recovery_config;
CREATE POLICY "Service role full access recovery_config" ON public.recovery_config FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_recovery_config_updated_at ON public.recovery_config;
CREATE TRIGGER update_recovery_config_updated_at
  BEFORE UPDATE ON public.recovery_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Recovery leads captured by webhook
CREATE TABLE IF NOT EXISTS public.recovery_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  customer_name text NOT NULL DEFAULT '',
  customer_email text NOT NULL,
  customer_phone text DEFAULT '',
  products jsonb DEFAULT '[]'::jsonb,
  total_value numeric NOT NULL DEFAULT 0,
  checkout_url text DEFAULT '',
  raw_payload jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pendente',
  email_sent_at timestamptz,
  sms_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recovery_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own loja recovery_leads" ON public.recovery_leads;
CREATE POLICY "Users access own loja recovery_leads" ON public.recovery_leads FOR ALL
  USING (user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (user_owns_loja(auth.uid(), loja_id));

DROP POLICY IF EXISTS "Service role full access recovery_leads" ON public.recovery_leads;
CREATE POLICY "Service role full access recovery_leads" ON public.recovery_leads FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_recovery_leads_loja_status ON public.recovery_leads(loja_id, status);
CREATE INDEX IF NOT EXISTS idx_recovery_leads_created ON public.recovery_leads(created_at DESC);



-- ===== 20260401201458_b301467e-aa07-48bf-b165-3de6b2cdf1ca.sql =====


-- Add tipo column to recovery_config
ALTER TABLE public.recovery_config
ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'carrinho';

-- Drop the existing unique constraint on loja_id (isOneToOne)
ALTER TABLE public.recovery_config DROP CONSTRAINT IF EXISTS recovery_config_loja_id_key;

-- Add new unique constraint on (loja_id, tipo)
DO $c$ BEGIN ALTER TABLE public.recovery_config
ADD CONSTRAINT recovery_config_loja_id_tipo_key UNIQUE (loja_id, tipo); EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $c$;

-- Add tipo column to recovery_leads
ALTER TABLE public.recovery_leads
ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'carrinho';



-- ===== 20260405120018_52de9293-8fe3-43bf-8158-9c6052d7f560.sql =====

ALTER TABLE public.recovery_leads
  ADD COLUMN IF NOT EXISTS pix_code text DEFAULT '',
  ADD COLUMN IF NOT EXISTS pix_qrcode_url text DEFAULT '';


-- ===== 20260405122725_97458c9f-d693-4076-ba96-a531b2d90a66.sql =====

INSERT INTO storage.buckets (id, name, public) VALUES ('pix-qrcodes', 'pix-qrcodes', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read pix-qrcodes" ON storage.objects;
CREATE POLICY "Public read pix-qrcodes" ON storage.objects FOR SELECT USING (bucket_id = 'pix-qrcodes');
DROP POLICY IF EXISTS "Service role upload pix-qrcodes" ON storage.objects;
CREATE POLICY "Service role upload pix-qrcodes" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'pix-qrcodes' AND auth.role() = 'service_role');



-- ===== 20260410180634_c44f11ef-88fd-4a04-ba85-8c95326311f5.sql =====


CREATE OR REPLACE FUNCTION public.get_loja_faturamento(p_loja_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(valor), 0) FROM envios 
  WHERE loja_id = p_loja_id AND deleted_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.get_loja_chart_data(p_loja_id uuid)
RETURNS TABLE(dia date, receita numeric, pedidos bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT created_at::date AS dia, SUM(valor) AS receita, COUNT(*) AS pedidos
  FROM envios
  WHERE loja_id = p_loja_id AND deleted_at IS NULL
  GROUP BY created_at::date
  ORDER BY created_at::date;
$$;



-- ===== 20260410181206_7c9c2708-5ef8-4a35-9dcf-0d6de45cebf8.sql =====


-- Function to get envios stats (counts by status)
CREATE OR REPLACE FUNCTION public.get_envios_stats(p_loja_id uuid)
RETURNS TABLE(total bigint, pendentes bigint, em_transito bigint, entregues bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status = 'pendente') AS pendentes,
    COUNT(*) FILTER (WHERE status = 'em_transito') AS em_transito,
    COUNT(*) FILTER (WHERE status = 'entregue') AS entregues
  FROM envios
  WHERE loja_id = p_loja_id AND deleted_at IS NULL;
$$;

-- Function to get paginated envios with filters and pedido join
CREATE OR REPLACE FUNCTION public.get_envios_paginated(
  p_loja_id uuid,
  p_search text DEFAULT '',
  p_status text DEFAULT 'todos',
  p_metodo text DEFAULT 'todos',
  p_origem text DEFAULT 'todos',
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_page int DEFAULT 1,
  p_per_page int DEFAULT 20
)
RETURNS TABLE(
  id uuid,
  cliente_nome text,
  cliente_email text,
  cliente_cpf text,
  cliente_telefone text,
  cliente_endereco text,
  cliente_numero text,
  cliente_bairro text,
  cliente_complemento text,
  cliente_cidade text,
  cliente_estado text,
  cliente_cep text,
  produto text,
  valor numeric,
  quantidade int,
  unidade text,
  cfop text,
  ncm_sh text,
  cst text,
  codigo_rastreio text,
  transportadora text,
  status shipment_status,
  status_label text,
  ultimo_evento_ordem int,
  proximo_avanco_em timestamptz,
  postagem_template_id uuid,
  nfe_numero text,
  nfe_serie text,
  nfe_chave_acesso text,
  empresa_id uuid,
  loja_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz,
  origem text,
  metodo_pagamento text,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset int;
  v_total bigint;
  v_search text;
BEGIN
  v_offset := (p_page - 1) * p_per_page;
  v_search := lower(COALESCE(p_search, ''));

  -- Count total matching records
  SELECT COUNT(*) INTO v_total
  FROM envios e
  LEFT JOIN pedidos p ON p.envio_id = e.id AND p.loja_id = e.loja_id
  WHERE e.loja_id = p_loja_id
    AND e.deleted_at IS NULL
    AND (v_search = '' OR (
      lower(e.cliente_nome) LIKE '%' || v_search || '%'
      OR lower(e.produto) LIKE '%' || v_search || '%'
      OR lower(COALESCE(e.codigo_rastreio, '')) LIKE '%' || v_search || '%'
      OR lower(e.cliente_email) LIKE '%' || v_search || '%'
      OR e.valor::text LIKE '%' || v_search || '%'
    ))
    AND (p_status = 'todos'
      OR e.status_label = p_status
      OR (p_status = 'Pendente' AND e.status = 'pendente' AND e.status_label IS NULL)
    )
    AND (p_date_from IS NULL OR e.created_at >= p_date_from)
    AND (p_date_to IS NULL OR e.created_at <= p_date_to)
    AND (p_metodo = 'todos' OR (
      (p_metodo = 'pix' AND lower(COALESCE(p.method, '')) LIKE '%pix%')
      OR (p_metodo = 'cartao' AND (lower(COALESCE(p.method, '')) LIKE '%card%' OR lower(COALESCE(p.method, '')) LIKE '%cartao%' OR lower(COALESCE(p.method, '')) LIKE '%cartão%' OR lower(COALESCE(p.method, '')) LIKE '%credit%'))
      OR (p_metodo = 'boleto' AND lower(COALESCE(p.method, '')) LIKE '%boleto%')
    ))
    AND (p_origem = 'todos' OR (
      (p_origem = 'manual' AND p.checkout_provider IS NULL)
      OR (p_origem != 'manual' AND p.checkout_provider = p_origem)
    ));

  RETURN QUERY
  SELECT
    e.id, e.cliente_nome, e.cliente_email, e.cliente_cpf, e.cliente_telefone,
    e.cliente_endereco, e.cliente_numero, e.cliente_bairro, e.cliente_complemento,
    e.cliente_cidade, e.cliente_estado, e.cliente_cep,
    e.produto, e.valor, e.quantidade, e.unidade,
    e.cfop, e.ncm_sh, e.cst,
    e.codigo_rastreio, e.transportadora,
    e.status, e.status_label, e.ultimo_evento_ordem,
    e.proximo_avanco_em, e.postagem_template_id,
    e.nfe_numero, e.nfe_serie, e.nfe_chave_acesso, e.empresa_id, e.loja_id,
    e.created_at, e.updated_at, e.deleted_at,
    p.checkout_provider AS origem,
    p.method AS metodo_pagamento,
    v_total AS total_count
  FROM envios e
  LEFT JOIN pedidos p ON p.envio_id = e.id AND p.loja_id = e.loja_id
  WHERE e.loja_id = p_loja_id
    AND e.deleted_at IS NULL
    AND (v_search = '' OR (
      lower(e.cliente_nome) LIKE '%' || v_search || '%'
      OR lower(e.produto) LIKE '%' || v_search || '%'
      OR lower(COALESCE(e.codigo_rastreio, '')) LIKE '%' || v_search || '%'
      OR lower(e.cliente_email) LIKE '%' || v_search || '%'
      OR e.valor::text LIKE '%' || v_search || '%'
    ))
    AND (p_status = 'todos'
      OR e.status_label = p_status
      OR (p_status = 'Pendente' AND e.status = 'pendente' AND e.status_label IS NULL)
    )
    AND (p_date_from IS NULL OR e.created_at >= p_date_from)
    AND (p_date_to IS NULL OR e.created_at <= p_date_to)
    AND (p_metodo = 'todos' OR (
      (p_metodo = 'pix' AND lower(COALESCE(p.method, '')) LIKE '%pix%')
      OR (p_metodo = 'cartao' AND (lower(COALESCE(p.method, '')) LIKE '%card%' OR lower(COALESCE(p.method, '')) LIKE '%cartao%' OR lower(COALESCE(p.method, '')) LIKE '%cartão%' OR lower(COALESCE(p.method, '')) LIKE '%credit%'))
      OR (p_metodo = 'boleto' AND lower(COALESCE(p.method, '')) LIKE '%boleto%')
    ))
    AND (p_origem = 'todos' OR (
      (p_origem = 'manual' AND p.checkout_provider IS NULL)
      OR (p_origem != 'manual' AND p.checkout_provider = p_origem)
    ))
  ORDER BY e.created_at DESC
  LIMIT p_per_page
  OFFSET v_offset;
END;
$$;



-- ===== 20260410184233_dd0e8d65-4762-42ee-9992-77b47aa035b8.sql =====

UPDATE postagem_config SET email_remetente = 'noreply@holdingtransportesbr.com' WHERE email_remetente = 'noreply@jltransportes.pro';

-- Consolidated schema migration

-- ===== 20260411183117_11c42b88-e9b5-44b7-9c99-158a796f4c1d.sql =====


-- Table: confirmacao_pagamento_config
CREATE TABLE IF NOT EXISTS public.confirmacao_pagamento_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT false,
  enviar_email boolean NOT NULL DEFAULT true,
  enviar_sms boolean NOT NULL DEFAULT true,
  assunto_email text NOT NULL DEFAULT 'Pagamento Confirmado! ✅ Seu pedido {{produto}} foi aprovado',
  corpo_email text NOT NULL DEFAULT '',
  sms_template text NOT NULL DEFAULT 'Ola {{nome}}! Seu pagamento de R${{valor}} foi confirmado. Obrigado pela compra!',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(loja_id)
);

ALTER TABLE public.confirmacao_pagamento_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own loja confirmacao_pagamento_config" ON public.confirmacao_pagamento_config;
CREATE POLICY "Users access own loja confirmacao_pagamento_config" ON public.confirmacao_pagamento_config FOR ALL
  USING (user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (user_owns_loja(auth.uid(), loja_id));

DROP TRIGGER IF EXISTS update_confirmacao_pagamento_config_updated_at ON public.confirmacao_pagamento_config;
CREATE TRIGGER update_confirmacao_pagamento_config_updated_at
  BEFORE UPDATE ON public.confirmacao_pagamento_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Table: confirmacao_pagamento_log
CREATE TABLE IF NOT EXISTS public.confirmacao_pagamento_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  pedido_id uuid REFERENCES public.pedidos(id),
  tipo text NOT NULL DEFAULT 'email',
  status text NOT NULL DEFAULT 'pending',
  custo numeric NOT NULL DEFAULT 0,
  destinatario text NOT NULL,
  error_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.confirmacao_pagamento_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own loja confirmacao_pagamento_log" ON public.confirmacao_pagamento_log;
CREATE POLICY "Users view own loja confirmacao_pagamento_log" ON public.confirmacao_pagamento_log FOR SELECT
  USING (user_owns_loja(auth.uid(), loja_id));

DROP POLICY IF EXISTS "Service role manage confirmacao_pagamento_log" ON public.confirmacao_pagamento_log;
CREATE POLICY "Service role manage confirmacao_pagamento_log" ON public.confirmacao_pagamento_log FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Insert default costs
INSERT INTO public.system_config (key, value, label) VALUES
  ('custo_confirmacao_email', 0.50, 'Custo por email de confirmação de pagamento'),
  ('custo_confirmacao_sms', 0.12, 'Custo por SMS de confirmação de pagamento')
ON CONFLICT (key) DO NOTHING;



-- ===== 20260411184409_4518c5d1-e042-4eda-a902-a0169d81ee5d.sql =====

ALTER TABLE public.confirmacao_pagamento_config
ADD COLUMN IF NOT EXISTS email_remetente_nome text DEFAULT '';


-- ===== 20260411192131_cb8bbe59-43c9-4188-990d-e96a04fe21c2.sql =====

UPDATE envios SET quantidade = 1 WHERE id IN (
  SELECT e.id FROM envios e JOIN pedidos p ON p.envio_id = e.id 
  WHERE p.checkout_provider = 'vega' AND e.quantidade > 10
);


-- ===== 20260411192506_f112c1e8-5924-46fd-a875-8499c6976bf8.sql =====

UPDATE envios SET valor = valor / 100 WHERE id IN (
  SELECT e.id FROM envios e JOIN pedidos p ON p.envio_id = e.id 
  WHERE p.checkout_provider = 'vega'
);
UPDATE pedidos SET total_price = total_price / 100 WHERE checkout_provider = 'vega' AND total_price > 100;


-- ===== 20260412205027_cc831815-32fe-4ce0-b7ba-b6a7ef5d7721.sql =====


-- Template Prolongado
INSERT INTO public.postagem_templates (id, nome, descricao, tipo, is_system, loja_id)
VALUES (
  '00000000-0000-0000-0000-000000000005',
  'Template Prolongado',
  'Template com muitas atualizações intermediárias para prolongar o rastreio do pedido',
  'prolongado',
  true,
  NULL
)
ON CONFLICT (id) DO NOTHING;

-- 14 eventos do Template Prolongado
INSERT INTO public.postagem_eventos (template_id, nome, descricao, status_label, ordem, delay_horas, enviar_email, enviar_nfe_pdf, is_final, assunto_email, corpo_email) VALUES
('00000000-0000-0000-0000-000000000005', 'Nota Fiscal Emitida', 'Nota fiscal emitida e pedido separado', 'Postado', 1, 0, true, true, false,
 '📄 {{empresa_nome}} - Nota Fiscal do seu pedido {{produto}}', NULL),

('00000000-0000-0000-0000-000000000005', 'Coletado pela Transportadora', 'Pedido coletado pela transportadora', 'Coletado', 2, 24, true, false, false,
 '📦 {{empresa_nome}} - Pedido coletado!', NULL),

('00000000-0000-0000-0000-000000000005', 'Objeto em transferência', 'Objeto em transferência para centro de distribuição', 'Em Trânsito', 3, 48, true, false, false,
 '🚛 {{empresa_nome}} - Objeto em transferência', NULL),

('00000000-0000-0000-0000-000000000005', 'Em trânsito para unidade de tratamento', 'Pacote encaminhado para unidade de tratamento', 'Em Trânsito', 4, 48, true, false, false,
 '🚛 {{empresa_nome}} - Pacote em trânsito', NULL),

('00000000-0000-0000-0000-000000000005', 'Em trânsito para unidade estadual', 'Pacote em trânsito para unidade de tratamento estadual', 'Em Trânsito', 5, 72, true, false, false,
 '🚛 {{empresa_nome}} - Atualização de trânsito', NULL),

('00000000-0000-0000-0000-000000000005', 'Seu pacote está em movimento', 'Pacote em movimento rumo ao destino', 'Em Trânsito', 6, 48, true, false, false,
 '🚛 {{empresa_nome}} - Seu pacote está em movimento!', NULL),

('00000000-0000-0000-0000-000000000005', 'Seu pacote está em movimento', 'Pacote continua em trânsito', 'Em Trânsito', 7, 120, true, false, false,
 '🚛 {{empresa_nome}} - Atualização do seu pedido', NULL),

('00000000-0000-0000-0000-000000000005', 'Seu pacote está em movimento', 'Pacote se aproximando da região de destino', 'Em Trânsito', 8, 120, true, false, false,
 '🚛 {{empresa_nome}} - Pedido a caminho', NULL),

('00000000-0000-0000-0000-000000000005', 'Seu pacote está em movimento', 'Pacote em deslocamento', 'Em Trânsito', 9, 120, true, false, false,
 '🚛 {{empresa_nome}} - Seu pedido continua a caminho', NULL),

('00000000-0000-0000-0000-000000000005', 'Seu pacote está em movimento', 'Pacote próximo da região de entrega', 'Em Trânsito', 10, 72, true, false, false,
 '🚛 {{empresa_nome}} - Quase lá!', NULL),

('00000000-0000-0000-0000-000000000005', 'Seu pacote está próximo', 'Pacote chegou ao centro de distribuição local', 'Centro Local', 11, 48, true, false, false,
 '📍 {{empresa_nome}} - Pacote no centro local', NULL),

('00000000-0000-0000-0000-000000000005', 'Seu pacote está próximo', 'Pacote sendo processado para entrega', 'Centro Local', 12, 48, true, false, false,
 '📍 {{empresa_nome}} - Preparando para entrega', NULL),

('00000000-0000-0000-0000-000000000005', 'Saiu para entrega', 'Pacote saiu para entrega ao destinatário', 'Saiu para Entrega', 13, 24, true, false, false,
 '🚚 {{empresa_nome}} - Saiu para entrega!', NULL),

('00000000-0000-0000-0000-000000000005', 'Pedido entregue', 'Pedido entregue com sucesso', 'Entregue', 14, 240, true, false, true,
 '✅ {{empresa_nome}} - Pedido entregue!', NULL);



-- ===== 20260412205520_ab065375-ae82-44ae-96bd-29c59d1e5519.sql =====


-- Remove eventos antigos do template prolongado
DELETE FROM public.postagem_eventos WHERE template_id = '00000000-0000-0000-0000-000000000005';

-- Inserir 16 novos eventos com nomes variados
INSERT INTO public.postagem_eventos (template_id, nome, descricao, status_label, ordem, delay_horas, enviar_email, enviar_nfe_pdf, is_final, assunto_email, corpo_email) VALUES
('00000000-0000-0000-0000-000000000005', 'Nota Fiscal Emitida', 'Nota fiscal emitida e pedido separado para envio', 'Postado', 1, 0, true, true, false,
 '📄 {{empresa_nome}} - Nota Fiscal do seu pedido {{produto}}', NULL),

('00000000-0000-0000-0000-000000000005', 'Coletado pela Transportadora', 'Pedido coletado pela transportadora na unidade de origem', 'Coletado', 2, 24, true, false, false,
 '📦 {{empresa_nome}} - Pedido coletado pela transportadora', NULL),

('00000000-0000-0000-0000-000000000005', 'Objeto encaminhado para centro de distribuição', 'Objeto encaminhado para o centro de distribuição regional', 'Em Trânsito', 3, 48, true, false, false,
 '🚛 {{empresa_nome}} - Objeto encaminhado para distribuição', NULL),

('00000000-0000-0000-0000-000000000005', 'Recebido na unidade de tratamento', 'Objeto recebido na unidade de tratamento para triagem', 'Em Trânsito', 4, 48, true, false, false,
 '🚛 {{empresa_nome}} - Recebido na unidade de tratamento', NULL),

('00000000-0000-0000-0000-000000000005', 'Em trânsito para unidade estadual', 'Objeto em trânsito para unidade de tratamento estadual', 'Em Trânsito', 5, 72, true, false, false,
 '🚛 {{empresa_nome}} - Em trânsito para unidade estadual', NULL),

('00000000-0000-0000-0000-000000000005', 'Objeto encaminhado para filial regional', 'Objeto encaminhado para filial regional de destino', 'Em Trânsito', 6, 48, true, false, false,
 '🚛 {{empresa_nome}} - Encaminhado para filial regional', NULL),

('00000000-0000-0000-0000-000000000005', 'Recebido na filial regional', 'Objeto recebido na filial regional próxima ao destino', 'Em Trânsito', 7, 120, true, false, false,
 '🚛 {{empresa_nome}} - Recebido na filial regional', NULL),

('00000000-0000-0000-0000-000000000005', 'Aguardando despacho para unidade local', 'Objeto aguardando despacho para a unidade de distribuição local', 'Em Trânsito', 8, 96, true, false, false,
 '🚛 {{empresa_nome}} - Aguardando despacho local', NULL),

('00000000-0000-0000-0000-000000000005', 'Objeto despachado para unidade local', 'Objeto despachado para a unidade de distribuição do destinatário', 'Em Trânsito', 9, 72, true, false, false,
 '🚛 {{empresa_nome}} - Despachado para unidade local', NULL),

('00000000-0000-0000-0000-000000000005', 'Recebido na unidade de distribuição', 'Objeto recebido na unidade de distribuição da cidade de destino', 'Em Trânsito', 10, 48, true, false, false,
 '🚛 {{empresa_nome}} - Chegou na sua cidade!', NULL),

('00000000-0000-0000-0000-000000000005', 'Objeto no centro de distribuição local', 'Objeto no centro de distribuição local aguardando separação', 'Centro Local', 11, 48, true, false, false,
 '📍 {{empresa_nome}} - Pacote no centro local', NULL),

('00000000-0000-0000-0000-000000000005', 'Em processo de separação para entrega', 'Objeto em processo de separação para rota de entrega', 'Centro Local', 12, 48, true, false, false,
 '📍 {{empresa_nome}} - Preparando para entrega', NULL),

('00000000-0000-0000-0000-000000000005', 'Seu pedido está próximo', 'Objeto separado e aguardando inclusão na rota de entrega', 'Centro Local', 13, 48, true, false, false,
 '📍 {{empresa_nome}} - Seu pedido está quase chegando!', NULL),

('00000000-0000-0000-0000-000000000005', 'Seu pedido está próximo', 'Objeto pronto para sair na próxima rota de entrega', 'Centro Local', 14, 24, true, false, false,
 '📍 {{empresa_nome}} - Pedido próximo de você!', NULL),

('00000000-0000-0000-0000-000000000005', 'Saiu para entrega ao destinatário', 'Objeto saiu para entrega ao destinatário', 'Saiu para Entrega', 15, 24, true, false, false,
 '🚚 {{empresa_nome}} - Saiu para entrega!', NULL),

('00000000-0000-0000-0000-000000000005', 'Pedido entregue com sucesso', 'Pedido entregue com sucesso ao destinatário', 'Entregue', 16, 240, true, false, true,
 '✅ {{empresa_nome}} - Pedido entregue!', NULL);



-- ===== 20260412210544_61a4859d-489f-4a66-8266-8414367aa4c8.sql =====


-- Delete old events from all non-system copies of Template Prolongado
DELETE FROM public.postagem_eventos 
WHERE template_id IN (
  SELECT id FROM public.postagem_templates 
  WHERE nome = 'Template Prolongado' AND is_system = false
);

-- Insert 16 new events for each non-system copy
INSERT INTO public.postagem_eventos (template_id, nome, descricao, status_label, ordem, delay_horas, enviar_email, enviar_nfe_pdf, is_final, assunto_email, corpo_email)
SELECT 
  t.id,
  e.nome,
  e.descricao,
  e.status_label,
  e.ordem,
  e.delay_horas,
  e.enviar_email,
  e.enviar_nfe_pdf,
  e.is_final,
  e.assunto_email,
  e.corpo_email
FROM public.postagem_templates t
CROSS JOIN public.postagem_eventos e
WHERE t.nome = 'Template Prolongado' 
  AND t.is_system = false
  AND e.template_id = '00000000-0000-0000-0000-000000000005';



-- ===== 20260416194617_905a663d-2e71-418b-b562-8f4e6aa9eafd.sql =====

ALTER TABLE public.postagem_config ADD COLUMN IF NOT EXISTS whatsapp_auto_send_started_at timestamptz;


-- ===== 20260416205002_18060b71-f6db-4301-9d22-d4bf0194c22b.sql =====

-- Persistent lock table for retry executions
CREATE TABLE IF NOT EXISTS public.retry_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'running',
  total_pendentes integer NOT NULL DEFAULT 0,
  processados integer NOT NULL DEFAULT 0,
  sucesso integer NOT NULL DEFAULT 0,
  falhas integer NOT NULL DEFAULT 0,
  mensagem text,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes')
);

CREATE INDEX IF NOT EXISTS idx_retry_execucoes_loja_status
  ON public.retry_execucoes (loja_id, status, expires_at DESC);

ALTER TABLE public.retry_execucoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own loja retry_execucoes" ON public.retry_execucoes;
DROP POLICY IF EXISTS "Users view own loja retry_execucoes" ON public.retry_execucoes;
CREATE POLICY "Users view own loja retry_execucoes" ON public.retry_execucoes FOR SELECT
  USING (public.user_owns_loja(auth.uid(), loja_id));

DROP POLICY IF EXISTS "Service role manage retry_execucoes" ON public.retry_execucoes;
DROP POLICY IF EXISTS "Service role manage retry_execucoes" ON public.retry_execucoes;
CREATE POLICY "Service role manage retry_execucoes" ON public.retry_execucoes FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins full access retry_execucoes" ON public.retry_execucoes;
DROP POLICY IF EXISTS "Admins full access retry_execucoes" ON public.retry_execucoes;
CREATE POLICY "Admins full access retry_execucoes" ON public.retry_execucoes FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger to keep updated_at fresh
DROP TRIGGER IF EXISTS trg_retry_execucoes_updated_at ON public.retry_execucoes;
DROP TRIGGER IF EXISTS trg_retry_execucoes_updated_at ON public.retry_execucoes;
CREATE TRIGGER trg_retry_execucoes_updated_at
  BEFORE UPDATE ON public.retry_execucoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for log + lock so the frontend reflects changes instantly
ALTER TABLE public.confirmacao_pagamento_log REPLICA IDENTITY FULL;
ALTER TABLE public.retry_execucoes REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.confirmacao_pagamento_log;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.retry_execucoes;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;


-- ===== 20260418153156_adfdc169-6da1-4132-a292-06e6934838e8.sql =====

UPDATE public.retry_execucoes SET status = 'error', mensagem = 'Execução travada por timeout - liberada para nova tentativa', finished_at = now(), expires_at = now() - interval '1 minute' WHERE status IN ('queued','running') AND expires_at > now() - interval '1 day';


-- ===== 20260418160700_c72bf0bd-0881-498b-9ef0-e2d30e944b32.sql =====


-- Índices para acelerar agregações no histórico de confirmação
CREATE INDEX IF NOT EXISTS idx_cpl_loja_created ON public.confirmacao_pagamento_log (loja_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cpl_loja_pedido ON public.confirmacao_pagamento_log (loja_id, pedido_id);

-- RPC: retorna grupos agregados (1 linha por pedido/destinatário) com paginação
CREATE OR REPLACE FUNCTION public.get_confirmacao_grouped(
  p_loja_id uuid,
  p_search text DEFAULT '',
  p_status text DEFAULT 'todos',  -- todos | enviados | pendentes
  p_date text DEFAULT NULL,        -- YYYY-MM-DD
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE(
  group_key text,
  pedido_id uuid,
  nome text,
  email text,
  telefone text,
  email_status text,
  sms_status text,
  custo_total numeric,
  created_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search text := lower(coalesce(p_search, ''));
BEGIN
  RETURN QUERY
  WITH latest AS (
    SELECT DISTINCT ON (coalesce(pedido_id::text, destinatario), tipo)
      coalesce(pedido_id::text, destinatario) AS gkey,
      pedido_id,
      tipo,
      status,
      destinatario,
      custo,
      created_at
    FROM confirmacao_pagamento_log
    WHERE loja_id = p_loja_id
    ORDER BY coalesce(pedido_id::text, destinatario), tipo, created_at DESC
  ),
  totals AS (
    SELECT coalesce(pedido_id::text, destinatario) AS gkey, sum(custo) AS custo_total, max(created_at) AS created_at
    FROM confirmacao_pagamento_log
    WHERE loja_id = p_loja_id
    GROUP BY coalesce(pedido_id::text, destinatario)
  ),
  grouped AS (
    SELECT
      l.gkey,
      max(l.pedido_id) AS pedido_id,
      max(CASE WHEN l.tipo = 'email' THEN l.status END) AS email_status,
      max(CASE WHEN l.tipo = 'sms'   THEN l.status END) AS sms_status,
      max(CASE WHEN l.tipo = 'email' THEN l.destinatario END) AS email,
      max(CASE WHEN l.tipo = 'sms'   THEN l.destinatario END) AS telefone
    FROM latest l
    GROUP BY l.gkey
  ),
  enriched AS (
    SELECT
      g.gkey AS group_key,
      g.pedido_id,
      coalesce(p.customer_name, '-') AS nome,
      coalesce(p.customer_email, g.email, '') AS email,
      coalesce(p.customer_phone, g.telefone, '') AS telefone,
      coalesce(g.email_status, 'none') AS email_status,
      coalesce(g.sms_status, 'none') AS sms_status,
      t.custo_total,
      t.created_at
    FROM grouped g
    LEFT JOIN pedidos p ON p.id = g.pedido_id
    LEFT JOIN totals t ON t.gkey = g.gkey
  ),
  filtered AS (
    SELECT * FROM enriched e
    WHERE
      (p_status = 'todos'
        OR (p_status = 'pendentes' AND (e.email_status = 'failed' OR e.sms_status = 'failed'))
        OR (p_status = 'enviados' AND e.email_status <> 'failed' AND e.sms_status <> 'failed'
            AND (e.email_status = 'sent' OR e.sms_status = 'sent'))
      )
      AND (v_search = '' OR lower(e.nome) LIKE '%'||v_search||'%'
           OR lower(e.email) LIKE '%'||v_search||'%'
           OR e.telefone LIKE '%'||v_search||'%')
      AND (p_date IS NULL OR p_date = '' OR to_char(e.created_at, 'YYYY-MM-DD') = p_date)
  ),
  counted AS (
    SELECT count(*) AS total_count FROM filtered
  )
  SELECT f.group_key, f.pedido_id, f.nome, f.email, f.telefone,
         f.email_status, f.sms_status, f.custo_total, f.created_at,
         (SELECT total_count FROM counted)
  FROM filtered f
  ORDER BY f.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- RPC para placar (contadores) sem trazer linhas
CREATE OR REPLACE FUNCTION public.get_confirmacao_placar(p_loja_id uuid)
RETURNS TABLE(enviados bigint, pendentes bigint, total bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH latest AS (
    SELECT DISTINCT ON (coalesce(pedido_id::text, destinatario), tipo)
      coalesce(pedido_id::text, destinatario) AS gkey,
      tipo, status
    FROM confirmacao_pagamento_log
    WHERE loja_id = p_loja_id
    ORDER BY coalesce(pedido_id::text, destinatario), tipo, created_at DESC
  ),
  grouped AS (
    SELECT
      gkey,
      max(CASE WHEN tipo='email' THEN status END) AS email_status,
      max(CASE WHEN tipo='sms'   THEN status END) AS sms_status
    FROM latest GROUP BY gkey
  )
  SELECT
    count(*) FILTER (WHERE email_status <> 'failed' AND sms_status IS DISTINCT FROM 'failed'
                     AND (email_status = 'sent' OR sms_status = 'sent')) AS enviados,
    count(*) FILTER (WHERE email_status = 'failed' OR sms_status = 'failed') AS pendentes,
    count(*) AS total
  FROM grouped;
$$;



-- ===== 20260418161402_6e531d3c-48b7-41ff-a45a-8e6d43321f56.sql =====

CREATE OR REPLACE FUNCTION public.get_confirmacao_grouped(
  p_loja_id uuid,
  p_search text DEFAULT '',
  p_status text DEFAULT 'todos',
  p_date text DEFAULT NULL,
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE(
  group_key text, pedido_id uuid, nome text, email text, telefone text,
  email_status text, sms_status text, custo_total numeric,
  created_at timestamptz, total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_search text := lower(coalesce(p_search, ''));
BEGIN
  RETURN QUERY
  WITH latest AS (
    SELECT DISTINCT ON (coalesce(c.pedido_id::text, c.destinatario), c.tipo)
      coalesce(c.pedido_id::text, c.destinatario) AS gkey,
      c.pedido_id AS pid, c.tipo, c.status, c.destinatario, c.custo, c.created_at
    FROM confirmacao_pagamento_log c
    WHERE c.loja_id = p_loja_id
    ORDER BY coalesce(c.pedido_id::text, c.destinatario), c.tipo, c.created_at DESC
  ),
  totals AS (
    SELECT coalesce(c.pedido_id::text, c.destinatario) AS gkey,
           sum(c.custo) AS custo_total, max(c.created_at) AS created_at
    FROM confirmacao_pagamento_log c
    WHERE c.loja_id = p_loja_id
    GROUP BY coalesce(c.pedido_id::text, c.destinatario)
  ),
  grouped AS (
    SELECT l.gkey,
      max(l.pid) AS pid,
      max(CASE WHEN l.tipo='email' THEN l.status END) AS email_status,
      max(CASE WHEN l.tipo='sms'   THEN l.status END) AS sms_status,
      max(CASE WHEN l.tipo='email' THEN l.destinatario END) AS email,
      max(CASE WHEN l.tipo='sms'   THEN l.destinatario END) AS telefone
    FROM latest l GROUP BY l.gkey
  ),
  enriched AS (
    SELECT g.gkey AS group_key, g.pid AS pedido_id,
      coalesce(p.customer_name, '-') AS nome,
      coalesce(p.customer_email, g.email, '') AS email,
      coalesce(p.customer_phone, g.telefone, '') AS telefone,
      coalesce(g.email_status, 'none') AS email_status,
      coalesce(g.sms_status, 'none') AS sms_status,
      t.custo_total, t.created_at
    FROM grouped g
    LEFT JOIN pedidos p ON p.id = g.pid
    LEFT JOIN totals t ON t.gkey = g.gkey
  ),
  filtered AS (
    SELECT * FROM enriched e
    WHERE (p_status='todos'
      OR (p_status='pendentes' AND (e.email_status='failed' OR e.sms_status='failed'))
      OR (p_status='enviados' AND e.email_status<>'failed' AND e.sms_status<>'failed'
          AND (e.email_status='sent' OR e.sms_status='sent')))
      AND (v_search='' OR lower(e.nome) LIKE '%'||v_search||'%'
           OR lower(e.email) LIKE '%'||v_search||'%'
           OR e.telefone LIKE '%'||v_search||'%')
      AND (p_date IS NULL OR p_date='' OR to_char(e.created_at,'YYYY-MM-DD')=p_date)
  ),
  counted AS (SELECT count(*) AS total_count FROM filtered)
  SELECT f.group_key, f.pedido_id, f.nome, f.email, f.telefone,
         f.email_status, f.sms_status, f.custo_total, f.created_at,
         (SELECT total_count FROM counted)
  FROM filtered f
  ORDER BY f.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;


-- ===== 20260418163059_ed1f4cf4-40ad-4af0-980f-66da4087f8e5.sql =====

CREATE OR REPLACE FUNCTION public.get_confirmacao_grouped(p_loja_id uuid, p_search text DEFAULT ''::text, p_status text DEFAULT 'todos'::text, p_date text DEFAULT NULL::text, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
 RETURNS TABLE(group_key text, pedido_id uuid, nome text, email text, telefone text, email_status text, sms_status text, custo_total numeric, created_at timestamp with time zone, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_search text := lower(coalesce(p_search, ''));
BEGIN
  RETURN QUERY
  WITH latest AS (
    SELECT DISTINCT ON (coalesce(c.pedido_id::text, c.destinatario), c.tipo)
      coalesce(c.pedido_id::text, c.destinatario) AS gkey,
      c.pedido_id::text AS pid_text, c.tipo, c.status, c.destinatario, c.custo, c.created_at
    FROM confirmacao_pagamento_log c
    WHERE c.loja_id = p_loja_id
    ORDER BY coalesce(c.pedido_id::text, c.destinatario), c.tipo, c.created_at DESC
  ),
  totals AS (
    SELECT coalesce(c.pedido_id::text, c.destinatario) AS gkey,
           sum(c.custo) AS custo_total, max(c.created_at) AS created_at
    FROM confirmacao_pagamento_log c
    WHERE c.loja_id = p_loja_id
    GROUP BY coalesce(c.pedido_id::text, c.destinatario)
  ),
  grouped AS (
    SELECT l.gkey,
      max(l.pid_text) AS pid_text,
      max(CASE WHEN l.tipo='email' THEN l.status END) AS email_status,
      max(CASE WHEN l.tipo='sms'   THEN l.status END) AS sms_status,
      max(CASE WHEN l.tipo='email' THEN l.destinatario END) AS email,
      max(CASE WHEN l.tipo='sms'   THEN l.destinatario END) AS telefone
    FROM latest l GROUP BY l.gkey
  ),
  enriched AS (
    SELECT g.gkey AS group_key,
      CASE WHEN g.pid_text IS NOT NULL THEN g.pid_text::uuid ELSE NULL END AS pedido_id,
      coalesce(p.customer_name, '-') AS nome,
      coalesce(p.customer_email, g.email, '') AS email,
      coalesce(p.customer_phone, g.telefone, '') AS telefone,
      coalesce(g.email_status, 'none') AS email_status,
      coalesce(g.sms_status, 'none') AS sms_status,
      t.custo_total, t.created_at
    FROM grouped g
    LEFT JOIN pedidos p ON p.id::text = g.pid_text
    LEFT JOIN totals t ON t.gkey = g.gkey
  ),
  filtered AS (
    SELECT * FROM enriched e
    WHERE (p_status='todos'
      OR (p_status='pendentes' AND (e.email_status='failed' OR e.sms_status='failed'))
      OR (p_status='enviados' AND e.email_status<>'failed' AND e.sms_status<>'failed'
          AND (e.email_status='sent' OR e.sms_status='sent')))
      AND (v_search='' OR lower(e.nome) LIKE '%'||v_search||'%'
           OR lower(e.email) LIKE '%'||v_search||'%'
           OR e.telefone LIKE '%'||v_search||'%')
      AND (p_date IS NULL OR p_date='' OR to_char(e.created_at,'YYYY-MM-DD')=p_date)
  ),
  counted AS (SELECT count(*) AS total_count FROM filtered)
  SELECT f.group_key, f.pedido_id, f.nome, f.email, f.telefone,
         f.email_status, f.sms_status, f.custo_total, f.created_at,
         (SELECT total_count FROM counted)
  FROM filtered f
  ORDER BY f.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$function$;


-- ===== 20260418163547_47f1c66f-af83-4c8d-97f4-fec44ad3912d.sql =====

-- Otimização: single-pass com window functions, sem CTEs duplicadas e sem ambiguidade
CREATE OR REPLACE FUNCTION public.get_confirmacao_grouped(
  p_loja_id uuid,
  p_search text DEFAULT ''::text,
  p_status text DEFAULT 'todos'::text,
  p_date text DEFAULT NULL::text,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  group_key text,
  pedido_id uuid,
  nome text,
  email text,
  telefone text,
  email_status text,
  sms_status text,
  custo_total numeric,
  created_at timestamp with time zone,
  total_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_search text := lower(coalesce(p_search, ''));
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      coalesce(c.pedido_id::text, c.destinatario) AS gkey,
      c.pedido_id,
      c.tipo,
      c.status,
      c.destinatario,
      c.custo,
      c.created_at,
      row_number() OVER (
        PARTITION BY coalesce(c.pedido_id::text, c.destinatario), c.tipo
        ORDER BY c.created_at DESC
      ) AS rn
    FROM confirmacao_pagamento_log c
    WHERE c.loja_id = p_loja_id
  ),
  totals AS (
    SELECT b.gkey, sum(b.custo) AS custo_total, max(b.created_at) AS last_at
    FROM base b
    GROUP BY b.gkey
  ),
  latest AS (
    SELECT * FROM base WHERE rn = 1
  ),
  grouped AS (
    SELECT
      l.gkey,
      max(l.pedido_id::text) AS pid_text,
      max(CASE WHEN l.tipo='email' THEN l.status END) AS email_st,
      max(CASE WHEN l.tipo='sms'   THEN l.status END) AS sms_st,
      max(CASE WHEN l.tipo='email' THEN l.destinatario END) AS email_dst,
      max(CASE WHEN l.tipo='sms'   THEN l.destinatario END) AS tel_dst
    FROM latest l
    GROUP BY l.gkey
  ),
  enriched AS (
    SELECT
      g.gkey AS gk,
      CASE WHEN g.pid_text ~ '^[0-9a-f]{8}-' THEN g.pid_text::uuid ELSE NULL END AS pid,
      coalesce(p.customer_name, '-') AS nm,
      coalesce(p.customer_email, g.email_dst, '') AS em,
      coalesce(p.customer_phone, g.tel_dst, '') AS tel,
      coalesce(g.email_st, 'none') AS est,
      coalesce(g.sms_st, 'none') AS sst,
      t.custo_total AS ct,
      t.last_at AS la
    FROM grouped g
    LEFT JOIN totals t ON t.gkey = g.gkey
    LEFT JOIN pedidos p
      ON g.pid_text ~ '^[0-9a-f]{8}-'
     AND p.id = g.pid_text::uuid
     AND p.loja_id = p_loja_id
  ),
  filtered AS (
    SELECT
      e.*,
      count(*) OVER () AS tc
    FROM enriched e
    WHERE
      (p_status = 'todos'
        OR (p_status = 'pendentes' AND (e.est = 'failed' OR e.sst = 'failed'))
        OR (p_status = 'enviados'
            AND e.est <> 'failed' AND e.sst <> 'failed'
            AND (e.est = 'sent' OR e.sst = 'sent')))
      AND (v_search = ''
        OR lower(e.nm) LIKE '%'||v_search||'%'
        OR lower(e.em) LIKE '%'||v_search||'%'
        OR e.tel LIKE '%'||v_search||'%')
      AND (p_date IS NULL OR p_date = ''
        OR to_char(e.la, 'YYYY-MM-DD') = p_date)
  )
  SELECT
    f.gk, f.pid, f.nm, f.em, f.tel,
    f.est, f.sst, f.ct, f.la, f.tc
  FROM filtered f
  ORDER BY f.la DESC NULLS LAST
  LIMIT p_limit OFFSET p_offset;
END;
$function$;

-- Índices de performance para acelerar agregação
CREATE INDEX IF NOT EXISTS idx_cpl_loja_created
  ON public.confirmacao_pagamento_log (loja_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cpl_loja_pedido_tipo
  ON public.confirmacao_pagamento_log (loja_id, pedido_id, tipo, created_at DESC);


-- ===== 20260419125144_c65a9c6b-02fa-4431-84e0-4036fb6ff77f.sql =====

-- Desabilitar e-mail no evento "Entregue" de todos os templates
UPDATE public.postagem_eventos
SET enviar_email = false
WHERE status_label = 'Entregue';


-- ===== 20260421135347_5f58d4e4-eb81-4306-aa90-db058cde8224.sql =====

-- Remover duplicatas mantendo o lead mais antigo por (loja_id, orderId)
DELETE FROM public.recovery_leads
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY loja_id, (raw_payload->>'orderId')
      ORDER BY created_at ASC
    ) AS rn
    FROM public.recovery_leads
    WHERE raw_payload->>'orderId' IS NOT NULL
  ) t WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS recovery_leads_loja_orderid_unique
ON public.recovery_leads (loja_id, ((raw_payload->>'orderId')))
WHERE raw_payload->>'orderId' IS NOT NULL;


-- ===== 20260423154809_2fea71e1-45d6-4084-8794-c018bfdedfbd.sql =====


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



-- ===== 20260423175138_8d1ab77a-8406-466c-8b1b-d9c39b26870e.sql =====

CREATE OR REPLACE FUNCTION public.try_create_envio_dedupe(_loja_id uuid, _cliente_email text, _valor numeric, _envio_data jsonb)
 RETURNS TABLE(envio_id uuid, codigo_rastreio text, was_duplicate boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _lock_key bigint;
  _existing_id uuid;
  _existing_codigo text;
  _new_id uuid;
  _new_codigo text;
  _one_hour_ago timestamptz := now() - interval '1 hour';
BEGIN
  _lock_key := hashtextextended(
    _loja_id::text || '|' || lower(coalesce(_cliente_email, '')) || '|' || coalesce(_valor::text, '0'),
    42
  );

  PERFORM pg_advisory_xact_lock(_lock_key);

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
    envio_id := _existing_id;
    codigo_rastreio := _existing_codigo;
    was_duplicate := true;
    RETURN NEXT;
    RETURN;
  END IF;

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
  RETURNING envios.id, envios.codigo_rastreio INTO _new_id, _new_codigo;

  envio_id := _new_id;
  codigo_rastreio := _new_codigo;
  was_duplicate := false;
  RETURN NEXT;
END;
$function$;


-- ===== 20260423175214_22791aeb-cb2e-48d7-a937-1d83d2e7a0d2.sql =====

DO $$
DECLARE
  p RECORD;
  new_envio_id uuid;
  produto_json text;
  qtd_total int;
  cust jsonb;
  addr jsonb;
  prods jsonb;
  empresa_uuid uuid;
BEGIN
  SELECT id INTO empresa_uuid FROM empresas WHERE loja_id = '522698d9-4e84-469c-a193-e323b2529978' LIMIT 1;

  FOR p IN
    SELECT * FROM pedidos
    WHERE loja_id = '522698d9-4e84-469c-a193-e323b2529978'
      AND status='paid' AND envio_id IS NULL
    ORDER BY created_at
  LOOP
    cust := p.raw_payload->'customer';
    addr := COALESCE(cust->'address', '{}'::jsonb);
    prods := COALESCE(p.products, '[]'::jsonb);

    SELECT string_agg(json_build_object('nome', x->>'title', 'quantidade', COALESCE((x->>'quantity')::int,1))::text, ',')
      INTO produto_json
      FROM jsonb_array_elements(prods) x;
    produto_json := COALESCE('[' || produto_json || ']', '[]');

    SELECT COALESCE(SUM(COALESCE((x->>'quantity')::int,1)), 1) INTO qtd_total
      FROM jsonb_array_elements(prods) x;

    INSERT INTO envios (
      cliente_nome, cliente_email, cliente_cpf, cliente_telefone,
      cliente_endereco, cliente_numero, cliente_bairro, cliente_cep,
      cliente_cidade, cliente_estado, cliente_complemento,
      produto, quantidade, valor, status, loja_id, empresa_id
    ) VALUES (
      COALESCE(p.customer_name, 'Cliente'),
      COALESCE(p.customer_email, 'sem-email@zedy.com'),
      p.customer_document, p.customer_phone,
      p.address_street, p.address_number, p.address_district, p.address_zip_code,
      p.address_city, p.address_state, p.address_complement,
      produto_json, qtd_total, p.total_price::numeric / 100,
      'pendente', p.loja_id, empresa_uuid
    ) RETURNING id INTO new_envio_id;

    UPDATE pedidos SET envio_id = new_envio_id WHERE id = p.id;
  END LOOP;
END $$;


-- ===== 20260423175923_5ab048c0-a4f7-4c1d-b7c6-a0304bad8eb8.sql =====

DO $$
DECLARE
  p RECORD;
  new_envio_id uuid;
  produto_json text;
  qtd_total int;
  prods jsonb;
  empresa_uuid uuid;
  cur_loja uuid;
BEGIN
  cur_loja := NULL;

  FOR p IN
    SELECT * FROM pedidos
    WHERE status='paid' AND envio_id IS NULL
    ORDER BY loja_id, created_at
  LOOP
    IF cur_loja IS DISTINCT FROM p.loja_id THEN
      SELECT id INTO empresa_uuid FROM empresas WHERE loja_id = p.loja_id LIMIT 1;
      cur_loja := p.loja_id;
    END IF;

    prods := COALESCE(p.products, '[]'::jsonb);

    SELECT string_agg(json_build_object('nome', x->>'title', 'quantidade', COALESCE((x->>'quantity')::int,1))::text, ',')
      INTO produto_json
      FROM jsonb_array_elements(prods) x;
    produto_json := COALESCE('[' || produto_json || ']', '[]');

    SELECT COALESCE(SUM(COALESCE((x->>'quantity')::int,1)), 1) INTO qtd_total
      FROM jsonb_array_elements(prods) x;

    INSERT INTO envios (
      cliente_nome, cliente_email, cliente_cpf, cliente_telefone,
      cliente_endereco, cliente_numero, cliente_bairro, cliente_cep,
      cliente_cidade, cliente_estado, cliente_complemento,
      produto, quantidade, valor, status, loja_id, empresa_id
    ) VALUES (
      COALESCE(p.customer_name, 'Cliente'),
      COALESCE(p.customer_email, 'sem-email@magnusfrete.com'),
      p.customer_document, p.customer_phone,
      p.address_street, p.address_number, p.address_district, p.address_zip_code,
      p.address_city, p.address_state, p.address_complement,
      produto_json, qtd_total, p.total_price::numeric / 100,
      'pendente', p.loja_id, empresa_uuid
    ) RETURNING id INTO new_envio_id;

    UPDATE pedidos SET envio_id = new_envio_id WHERE id = p.id;
  END LOOP;
END $$;


-- ===== 20260427232315_9200d52e-c379-4ec3-8751-32424d297322.sql =====

CREATE TABLE IF NOT EXISTS public.live_view_pings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id uuid NOT NULL,
  session_id text NOT NULL,
  codigo_rastreio text,
  cidade text,
  estado text,
  pais text,
  pais_codigo text,
  lat numeric,
  lng numeric,
  user_agent text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS live_view_pings_session_codigo_uniq
  ON public.live_view_pings (session_id, COALESCE(codigo_rastreio, ''));

CREATE INDEX IF NOT EXISTS live_view_pings_loja_lastseen_idx
  ON public.live_view_pings (loja_id, last_seen_at DESC);

ALTER TABLE public.live_view_pings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manage live_view_pings" ON public.live_view_pings;
CREATE POLICY "Service role manage live_view_pings" ON public.live_view_pings
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users view own loja live_view_pings" ON public.live_view_pings;
CREATE POLICY "Users view own loja live_view_pings" ON public.live_view_pings
  FOR SELECT
  USING (public.user_owns_loja(auth.uid(), loja_id));

ALTER TABLE public.live_view_pings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_view_pings;


-- ===== 20260428000435_a296f3f2-1532-4449-b417-f6b1f2a043c5.sql =====

-- Deduplicate existing pings: keep the oldest row per (loja, session, codigo), delete the rest
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY loja_id, session_id, codigo_rastreio
           ORDER BY created_at ASC
         ) AS rn
  FROM public.live_view_pings
)
DELETE FROM public.live_view_pings
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Prevent future duplicates and enable safe upserts
CREATE UNIQUE INDEX IF NOT EXISTS live_view_pings_unique_session_codigo
  ON public.live_view_pings (loja_id, session_id, codigo_rastreio);


-- ===== 20260428173057_89e29f6f-c02a-4597-bf7b-dbd782a9783e.sql =====

CREATE OR REPLACE FUNCTION public.get_confirmacao_placar(p_loja_id uuid)
 RETURNS TABLE(enviados bigint, pendentes bigint, total bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH latest AS (
    SELECT DISTINCT ON (coalesce(pedido_id::text, destinatario), tipo)
      coalesce(pedido_id::text, destinatario) AS gkey,
      tipo, status
    FROM confirmacao_pagamento_log
    WHERE loja_id = p_loja_id
    ORDER BY coalesce(pedido_id::text, destinatario), tipo, created_at DESC
  ),
  grouped AS (
    SELECT
      gkey,
      max(CASE WHEN tipo='email' THEN status END) AS email_status,
      max(CASE WHEN tipo='sms'   THEN status END) AS sms_status
    FROM latest GROUP BY gkey
  ),
  unified AS (
    SELECT
      gkey,
      CASE
        WHEN email_status = 'sent'   THEN 'sent'
        WHEN email_status = 'failed' THEN 'failed'
        WHEN email_status IS NULL AND sms_status = 'sent'   THEN 'sent'
        WHEN email_status IS NULL AND sms_status = 'failed' THEN 'failed'
        ELSE 'none'
      END AS final_status
    FROM grouped
  )
  SELECT
    count(*) FILTER (WHERE final_status = 'sent')   AS enviados,
    count(*) FILTER (WHERE final_status = 'failed') AS pendentes,
    count(*) AS total
  FROM unified;
$function$;

