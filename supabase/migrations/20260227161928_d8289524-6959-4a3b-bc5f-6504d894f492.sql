
-- Tabela para templates de SMS editáveis
CREATE TABLE public.sms_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_key text UNIQUE NOT NULL,
  status_label text NOT NULL,
  mensagem text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access sms_templates"
  ON public.sms_templates FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can read sms_templates"
  ON public.sms_templates FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

-- Trigger updated_at
CREATE TRIGGER update_sms_templates_updated_at
  BEFORE UPDATE ON public.sms_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed data com as 9 mensagens atuais
INSERT INTO public.sms_templates (status_key, status_label, mensagem) VALUES
  ('Coletado', 'Coletado', 'Ola {nome}. Seu CODIGO DE RASTREIO esta disponivel, acesse: [{link}] FIQUE ATENTO A SEU EMAIL.'),
  ('Postado', 'Postado', 'Ola {nome}. Seu CODIGO DE RASTREIO esta disponivel, acesse: [{link}] FIQUE ATENTO A SEU EMAIL.'),
  ('Em Transito', 'Em Trânsito', 'Ola {nome}, seu produto esta em transito. Acesse: [{link}] para acompanhar.'),
  ('Centro Local', 'Centro Local', 'Ola {nome}, seu produto esta no centro de distribuicao. Acesse: [{link}] para acompanhar.'),
  ('Taxacao', 'Taxação', 'Ola {nome}, seu produto esta em observacao. Confira seu e-mail e acesse: [{link}]'),
  ('Pago', 'Pago', 'Ola {nome}, pagamento confirmado. Acesse: [{link}] para acompanhar a entrega.'),
  ('Saiu para Entrega', 'Saiu para Entrega', 'Ola {nome}, seu produto saiu para entrega. Acesse: [{link}] para acompanhar.'),
  ('Em Rota', 'Em Rota', 'Ola {nome}, seu produto saiu para entrega. Acesse: [{link}] para acompanhar.'),
  ('Entregue', 'Entregue', 'Ola {nome}, seu produto foi entregue! Acesse: [{link}] para mais detalhes.'),
  ('default', 'Padrão', 'Ola {nome}, atualizacao do seu pedido. Acesse: [{link}] para acompanhar.');
