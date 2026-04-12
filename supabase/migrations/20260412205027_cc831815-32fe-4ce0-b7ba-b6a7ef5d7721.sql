
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
