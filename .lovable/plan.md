
O usuário quer que envios que falharam por saldo insuficiente sejam reprocessados automaticamente após recarga, com opção manual também.

Contexto rápido:
- Falhas de saldo geram registros em `confirmacao_pagamento_log` com `status='failed'` e `error_reason` contendo "Saldo insuficiente" / "Insufficient".
- Para WhatsApp, a fila usa `whatsapp_send_queue` — itens com erro de saldo ficam com `status='failed'` e `error_reason` similar.
- Recargas chegam via webhooks PIX (CyberPay/OpenPix) que atualizam `pix_payments.status='PAID'` e creditam `creditos.saldo`.

Estratégia: combinar **automático no momento da recarga** + **botão manual** como fallback.
