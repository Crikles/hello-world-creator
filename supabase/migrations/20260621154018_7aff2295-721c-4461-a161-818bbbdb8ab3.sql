
-- 1) Tabela de etapas do fluxo Global
CREATE TABLE IF NOT EXISTS public.global_flow_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  step_order int NOT NULL CHECK (step_order BETWEEN 1 AND 10),
  step_key text NOT NULL,
  nome_pt text NOT NULL,
  nome_en text NOT NULL,
  nome_es text NOT NULL,
  delay_horas int NOT NULL DEFAULT 24,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (loja_id, step_order)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.global_flow_eventos TO authenticated;
GRANT ALL ON public.global_flow_eventos TO service_role;

ALTER TABLE public.global_flow_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage global_flow_eventos"
  ON public.global_flow_eventos FOR ALL
  USING (public.user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (public.user_owns_loja(auth.uid(), loja_id));

CREATE TRIGGER update_global_flow_eventos_updated_at
  BEFORE UPDATE ON public.global_flow_eventos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Função que faz seed das 10 etapas padrão para uma loja
CREATE OR REPLACE FUNCTION public.seed_global_flow_eventos(_loja_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  steps text[][] := ARRAY[
    ARRAY['order_received',       'Pedido Recebido',              'Order Received',                 'Pedido Recibido'],
    ARRAY['order_prepared',       'Pedido Preparado',             'Order Prepared',                 'Pedido Preparado'],
    ARRAY['shipped_by_sender',    'Enviado pelo Remetente',       'Shipped by Sender',              'Enviado por el Remitente'],
    ARRAY['left_origin',          'Saiu do País de Origem',       'Left Country of Origin',         'Salió del País de Origen'],
    ARRAY['international_transit','Em Transporte Internacional',  'In International Transit',       'En Tránsito Internacional'],
    ARRAY['arrived_destination',  'Chegou ao País de Destino',    'Arrived at Destination Country', 'Llegó al País de Destino'],
    ARRAY['customs',              'Em Processamento Aduaneiro',   'In Customs Processing',          'En Procesamiento Aduanero'],
    ARRAY['local_transit',        'Em Transporte Local',          'In Local Transit',               'En Tránsito Local'],
    ARRAY['out_for_delivery',     'Saiu para Entrega',            'Out for Delivery',               'Salió para Entrega'],
    ARRAY['delivered',            'Entregue',                     'Delivered',                      'Entregado']
  ];
  delays int[] := ARRAY[0, 24, 24, 48, 72, 168, 24, 48, 24, 24];
  i int;
BEGIN
  FOR i IN 1..10 LOOP
    INSERT INTO public.global_flow_eventos (loja_id, step_order, step_key, nome_pt, nome_en, nome_es, delay_horas, ativo)
    VALUES (_loja_id, i, steps[i][1], steps[i][2], steps[i][3], steps[i][4], delays[i], true)
    ON CONFLICT (loja_id, step_order) DO NOTHING;
  END LOOP;
END $$;

-- 3) Trigger: ao criar uma config global, gera os eventos padrão
CREATE OR REPLACE FUNCTION public.tg_seed_global_flow_eventos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_global_flow_eventos(NEW.loja_id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS seed_global_flow_eventos_on_config ON public.global_flow_config;
CREATE TRIGGER seed_global_flow_eventos_on_config
  AFTER INSERT ON public.global_flow_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_seed_global_flow_eventos();

-- 4) Backfill para lojas que já têm config global
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT loja_id FROM public.global_flow_config LOOP
    PERFORM public.seed_global_flow_eventos(r.loja_id);
  END LOOP;
END $$;

-- 5) Rótulos amigáveis no admin para as chaves de custo Global
UPDATE public.system_config SET label = 'Fluxo Global - Emails de Rastreio (10 etapas)' WHERE key = 'custo_global_flow_email';
UPDATE public.system_config SET label = 'Fluxo Global - SMS de Rastreio (por SMS)'      WHERE key = 'custo_global_flow_sms';
UPDATE public.system_config SET label = 'Fluxo Global - Email de Confirmação de Pagamento' WHERE key = 'custo_global_flow_confirmacao_email';
