
-- Add new shipment statuses
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'coletado';
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'centro_local';
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'taxacao';
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'pagamento_confirmado';

-- Templates table
CREATE TABLE public.postagem_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id uuid REFERENCES public.lojas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  tipo text NOT NULL DEFAULT 'custom',
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.postagem_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read system templates"
  ON public.postagem_templates FOR SELECT
  USING (is_system = true);

CREATE POLICY "Users access own loja templates"
  ON public.postagem_templates FOR ALL
  USING (user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (user_owns_loja(auth.uid(), loja_id));

-- Eventos table
CREATE TABLE public.postagem_eventos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES public.postagem_templates(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  status_label text,
  ordem integer NOT NULL DEFAULT 0,
  delay_horas integer NOT NULL DEFAULT 0,
  enviar_email boolean NOT NULL DEFAULT true,
  enviar_nfe_pdf boolean NOT NULL DEFAULT false,
  assunto_email text,
  corpo_email text,
  is_final boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.postagem_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read system template eventos"
  ON public.postagem_eventos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.postagem_templates t
    WHERE t.id = template_id AND t.is_system = true
  ));

CREATE POLICY "Users access own loja template eventos"
  ON public.postagem_eventos FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.postagem_templates t
    WHERE t.id = template_id AND user_owns_loja(auth.uid(), t.loja_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.postagem_templates t
    WHERE t.id = template_id AND user_owns_loja(auth.uid(), t.loja_id)
  ));

-- Config table
CREATE TABLE public.postagem_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE UNIQUE,
  template_ativo_id uuid REFERENCES public.postagem_templates(id) ON DELETE SET NULL,
  enviar_emails boolean NOT NULL DEFAULT true,
  enviar_nfe_email boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.postagem_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own loja config"
  ON public.postagem_config FOR ALL
  USING (user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (user_owns_loja(auth.uid(), loja_id));

CREATE TRIGGER update_postagem_config_updated_at
  BEFORE UPDATE ON public.postagem_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Email log table
CREATE TABLE public.postagem_email_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  envio_id uuid REFERENCES public.envios(id) ON DELETE SET NULL,
  evento_id uuid REFERENCES public.postagem_eventos(id) ON DELETE SET NULL,
  destinatario text NOT NULL,
  assunto text,
  status text NOT NULL DEFAULT 'pending',
  custo numeric NOT NULL DEFAULT 0.15,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.postagem_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own loja email logs"
  ON public.postagem_email_log FOR ALL
  USING (user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (user_owns_loja(auth.uid(), loja_id));

-- Seed system templates
-- Nacional Padrão
INSERT INTO public.postagem_templates (id, loja_id, nome, descricao, tipo, is_system) VALUES
  ('00000000-0000-0000-0000-000000000001', null, 'Nacional Padrão', 'Fluxo padrão com 6 eventos de rastreamento', 'padrao', true);

INSERT INTO public.postagem_eventos (template_id, nome, descricao, status_label, ordem, delay_horas, enviar_email, enviar_nfe_pdf, assunto_email, corpo_email, is_final) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Nota Fiscal Emitida', 'A nota fiscal do pedido foi emitida', 'Postado', 1, 0, true, true, 'Nota Fiscal Emitida - {{produto}}', '<p>Olá {{cliente_nome}},</p><p>Sua nota fiscal foi emitida para o produto <b>{{produto}}</b>.</p><p>Código de rastreio: {{codigo_rastreio}}</p>', false),
  ('00000000-0000-0000-0000-000000000001', 'Pedido Coletado', 'O pedido foi coletado pela transportadora', 'Coletado', 2, 2, true, false, 'Pedido Coletado - {{produto}}', '<p>Olá {{cliente_nome}},</p><p>Seu pedido <b>{{produto}}</b> foi coletado pela transportadora.</p>', false),
  ('00000000-0000-0000-0000-000000000001', 'Em Trânsito', 'O pedido está em trânsito', 'Em Trânsito', 3, 24, true, false, 'Pedido em Trânsito - {{produto}}', '<p>Olá {{cliente_nome}},</p><p>Seu pedido <b>{{produto}}</b> está em trânsito.</p>', false),
  ('00000000-0000-0000-0000-000000000001', 'Centro de Distribuição', 'O pedido chegou ao centro de distribuição local', 'Centro Local', 4, 48, true, false, 'Pedido no Centro de Distribuição - {{produto}}', '<p>Olá {{cliente_nome}},</p><p>Seu pedido <b>{{produto}}</b> chegou ao centro de distribuição da sua região.</p>', false),
  ('00000000-0000-0000-0000-000000000001', 'Saiu para Entrega', 'O pedido saiu para entrega', 'Saiu para Entrega', 5, 2, true, false, 'Pedido Saiu para Entrega - {{produto}}', '<p>Olá {{cliente_nome}},</p><p>Seu pedido <b>{{produto}}</b> saiu para entrega! Fique atento.</p>', false),
  ('00000000-0000-0000-0000-000000000001', 'Entregue', 'O pedido foi entregue com sucesso', 'Entregue', 6, 4, true, false, 'Pedido Entregue - {{produto}}', '<p>Olá {{cliente_nome}},</p><p>Seu pedido <b>{{produto}}</b> foi entregue com sucesso!</p>', true);

-- Nacional Taxação
INSERT INTO public.postagem_templates (id, loja_id, nome, descricao, tipo, is_system) VALUES
  ('00000000-0000-0000-0000-000000000002', null, 'Nacional Taxação', 'Fluxo com taxação alfandegária - 8 eventos', 'taxacao', true);

INSERT INTO public.postagem_eventos (template_id, nome, descricao, status_label, ordem, delay_horas, enviar_email, enviar_nfe_pdf, assunto_email, corpo_email, is_final) VALUES
  ('00000000-0000-0000-0000-000000000002', 'Nota Fiscal Emitida', 'A nota fiscal do pedido foi emitida', 'Postado', 1, 0, true, true, 'Nota Fiscal Emitida - {{produto}}', '<p>Olá {{cliente_nome}},</p><p>Sua nota fiscal foi emitida para o produto <b>{{produto}}</b>.</p>', false),
  ('00000000-0000-0000-0000-000000000002', 'Pedido Coletado', 'O pedido foi coletado pela transportadora', 'Coletado', 2, 2, true, false, 'Pedido Coletado - {{produto}}', '<p>Olá {{cliente_nome}},</p><p>Seu pedido <b>{{produto}}</b> foi coletado.</p>', false),
  ('00000000-0000-0000-0000-000000000002', 'Em Trânsito', 'O pedido está em trânsito', 'Em Trânsito', 3, 24, true, false, 'Pedido em Trânsito - {{produto}}', '<p>Olá {{cliente_nome}},</p><p>Seu pedido está em trânsito.</p>', false),
  ('00000000-0000-0000-0000-000000000002', 'Centro de Distribuição', 'O pedido chegou ao centro de distribuição', 'Centro Local', 4, 48, true, false, 'Centro de Distribuição - {{produto}}', '<p>Olá {{cliente_nome}},</p><p>Seu pedido chegou ao centro de distribuição.</p>', false),
  ('00000000-0000-0000-0000-000000000002', 'Aguardando Pagamento', 'Pedido taxado - aguardando pagamento', 'Taxação', 5, 2, true, false, 'Pagamento Pendente - Taxação - {{produto}}', '<p>Olá {{cliente_nome}},</p><p>Seu pedido <b>{{produto}}</b> foi taxado e está aguardando pagamento.</p>', false),
  ('00000000-0000-0000-0000-000000000002', 'Pagamento Confirmado', 'Pagamento da taxação confirmado', 'Pago', 6, 0, true, false, 'Pagamento Confirmado - {{produto}}', '<p>Olá {{cliente_nome}},</p><p>O pagamento da taxação do pedido <b>{{produto}}</b> foi confirmado.</p>', false),
  ('00000000-0000-0000-0000-000000000002', 'Saiu para Entrega', 'O pedido saiu para entrega', 'Saiu para Entrega', 7, 2, true, false, 'Saiu para Entrega - {{produto}}', '<p>Olá {{cliente_nome}},</p><p>Seu pedido saiu para entrega!</p>', false),
  ('00000000-0000-0000-0000-000000000002', 'Entregue', 'O pedido foi entregue', 'Entregue', 8, 4, true, false, 'Pedido Entregue - {{produto}}', '<p>Olá {{cliente_nome}},</p><p>Seu pedido foi entregue com sucesso!</p>', true);

-- Nacional Expressa
INSERT INTO public.postagem_templates (id, loja_id, nome, descricao, tipo, is_system) VALUES
  ('00000000-0000-0000-0000-000000000003', null, 'Nacional Expressa', 'Fluxo expresso com 3 eventos', 'expressa', true);

INSERT INTO public.postagem_eventos (template_id, nome, descricao, status_label, ordem, delay_horas, enviar_email, enviar_nfe_pdf, assunto_email, corpo_email, is_final) VALUES
  ('00000000-0000-0000-0000-000000000003', 'Pedido Confirmado', 'O pedido foi confirmado e coletado', 'Coletado', 1, 0, true, true, 'Pedido Confirmado - {{produto}}', '<p>Olá {{cliente_nome}},</p><p>Seu pedido <b>{{produto}}</b> foi confirmado!</p>', false),
  ('00000000-0000-0000-0000-000000000003', 'Em Rota de Entrega', 'O pedido está em rota de entrega', 'Em Rota', 2, 24, true, false, 'Em Rota de Entrega - {{produto}}', '<p>Olá {{cliente_nome}},</p><p>Seu pedido está em rota de entrega.</p>', false),
  ('00000000-0000-0000-0000-000000000003', 'Entregue', 'O pedido foi entregue', 'Entregue', 3, 4, true, false, 'Pedido Entregue - {{produto}}', '<p>Olá {{cliente_nome}},</p><p>Seu pedido foi entregue com sucesso!</p>', true);
