-- Migration para adicionar a funcionalidade "Falha na Entrega"
-- Adiciona colunas em postagem_config
ALTER TABLE public.postagem_config ADD COLUMN IF NOT EXISTS ativar_falha_entrega boolean NOT NULL DEFAULT false;
ALTER TABLE public.postagem_config ADD COLUMN IF NOT EXISTS msg_falha_entrega text;
ALTER TABLE public.postagem_config ADD COLUMN IF NOT EXISTS checkout_url_falha text;
ALTER TABLE public.postagem_config ADD COLUMN IF NOT EXISTS valor_taxa_falha numeric DEFAULT 0;

-- Adiciona o evento de "Falha na Entrega" aos templates de sistema existentes (Nacional Padrão e Nacional Taxação)
-- O status_label será 'Falha na Entrega'
-- A ordem ideal é 5.5, para ficar entre 'Saiu para Entrega' (5) e 'Entregue' (6).
-- Como a coluna ordem é integer, vamos precisar atualizar as ordens de Entregue (6 -> 7) e inserir Falha na Entrega como 6

DO $$
DECLARE
    template_padrao_id uuid := '00000000-0000-0000-0000-000000000001';
    template_taxacao_id uuid := '00000000-0000-0000-0000-000000000002';
BEGIN
    -- Atualiza Nacional Padrão
    -- Move Entregue de 6 para 7
    UPDATE public.postagem_eventos SET ordem = 7 WHERE template_id = template_padrao_id AND status_label = 'Entregue';
    
    -- Insere Falha na Entrega na ordem 6
    INSERT INTO public.postagem_eventos (template_id, nome, descricao, status_label, ordem, delay_horas, enviar_email, enviar_nfe_pdf, assunto_email, corpo_email, is_final) 
    VALUES (
        template_padrao_id, 
        'Falha na Entrega', 
        'Tentativa de entrega não sucedida. Aguardando pagamento de nova taxa de envio.', 
        'Falha Entrega', 
        6, 
        24, 
        true, 
        false, 
        '⚠️ Aviso de Falha na Entrega - {{produto}}', 
        '<p>Olá {{cliente_nome}},</p><p>Houve uma falha na tentativa de entrega do seu pedido <b>{{produto}}</b>.</p><p>Para reenviarmos, por favor pague a taxa de retentativa.</p>', 
        false
    ) ON CONFLICT DO NOTHING;

    -- Atualiza Nacional Taxação
    -- Taxação tem Saiu para Entrega = 7 e Entregue = 8
    -- Move Entregue de 8 para 9
    UPDATE public.postagem_eventos SET ordem = 9 WHERE template_id = template_taxacao_id AND status_label = 'Entregue';

    -- Insere Falha na Entrega na ordem 8
    INSERT INTO public.postagem_eventos (template_id, nome, descricao, status_label, ordem, delay_horas, enviar_email, enviar_nfe_pdf, assunto_email, corpo_email, is_final) 
    VALUES (
        template_taxacao_id, 
        'Falha na Entrega', 
        'Tentativa de entrega não sucedida. Aguardando pagamento de nova taxa de envio.', 
        'Falha Entrega', 
        8, 
        24, 
        true, 
        false, 
        '⚠️ Aviso de Falha na Entrega - {{produto}}', 
        '<p>Olá {{cliente_nome}},</p><p>Houve uma falha na tentativa de entrega do seu pedido <b>{{produto}}</b>.</p><p>Para reenviarmos, por favor pague a taxa de retentativa.</p>', 
        false
    ) ON CONFLICT DO NOTHING;
END $$;
