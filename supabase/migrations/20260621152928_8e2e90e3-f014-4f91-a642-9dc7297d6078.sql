INSERT INTO public.system_config (key, value, label) VALUES
  ('custo_global_flow_email', 1.20, 'Custo total do fluxo global de 10 emails internacionais'),
  ('custo_global_flow_sms', 0.20, 'Custo por SMS de rastreio internacional'),
  ('custo_global_flow_confirmacao_email', 1.00, 'Custo por email de confirmação de pagamento internacional')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, label = EXCLUDED.label, updated_at = now();