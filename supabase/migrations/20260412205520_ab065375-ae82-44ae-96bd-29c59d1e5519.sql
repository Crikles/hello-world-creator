
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
