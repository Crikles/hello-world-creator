DO $$
DECLARE
  rec RECORD;
  falha_ordem INTEGER;
BEGIN
  FOR rec IN 
    SELECT DISTINCT template_id, ordem 
    FROM postagem_eventos 
    WHERE status_label = 'Falha Entrega'
  LOOP
    falha_ordem := rec.ordem;
    
    IF NOT EXISTS (
      SELECT 1 FROM postagem_eventos 
      WHERE template_id = rec.template_id AND status_label = 'Reenvio Pago'
    ) THEN
      UPDATE postagem_eventos 
      SET ordem = ordem + 2 
      WHERE template_id = rec.template_id 
        AND ordem > falha_ordem;
      
      INSERT INTO postagem_eventos (template_id, nome, status_label, ordem, delay_horas, enviar_email, enviar_nfe_pdf, is_final, descricao, assunto_email, corpo_email)
      VALUES (
        rec.template_id,
        'Reenvio Pago',
        'Reenvio Pago',
        falha_ordem + 1,
        24,
        true,
        false,
        false,
        'Pagamento do reenvio confirmado',
        'Reenvio confirmado! Seu pedido será reenviado - {{codigo_rastreio}}',
        'Ótima notícia! Recebemos o pagamento da taxa de reenvio do seu pedido **{{produto}}**.\n\nSeu pedido será preparado e reenviado em breve. Fique atento às próximas atualizações de rastreio.'
      );
      
      INSERT INTO postagem_eventos (template_id, nome, status_label, ordem, delay_horas, enviar_email, enviar_nfe_pdf, is_final, descricao, assunto_email, corpo_email)
      VALUES (
        rec.template_id,
        'Reenvio Saiu para Entrega',
        'Reenvio Saiu',
        falha_ordem + 2,
        24,
        true,
        false,
        false,
        'Pedido saiu novamente para entrega',
        'Seu pedido saiu para entrega novamente! - {{codigo_rastreio}}',
        'Seu pedido **{{produto}}** saiu novamente para entrega!\n\nDesta vez, certifique-se de que alguém estará no endereço para receber a encomenda.'
      );
    END IF;
  END LOOP;
END $$;