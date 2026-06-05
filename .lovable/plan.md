## Objetivo
Forçar todos os 291 envios da loja "use one fit" (useonefit2026@gmail.com) para a etapa **"Centro Local — Chegou perto de você"** (ordem 7) sem disparar nenhum e-mail ou SMS.

## Como o rastreio público decide a etapa
A página de rastreio lê de `envios`:
- `ultimo_evento_ordem` — define até qual passo da timeline está aceso
- `status_label` — texto mostrado no topo
- `postagem_template_id` — template de eventos usado

Encontrei o evento alvo já configurado para essa loja:
- `loja_id`: 86829180-1015-402d-ba18-b772cf50694e
- `template_id`: 5836c44c-0490-4f5d-8a9d-a67956c42a24
- `ordem`: 7, `status_label`: "Chegou perto de você"

## Atualização a aplicar (1 UPDATE)
Em `public.envios`, para `loja_id = 86829180-1015-402d-ba18-b772cf50694e` e `deleted_at IS NULL`:
- `ultimo_evento_ordem = 7`
- `status_label = 'Chegou perto de você'`
- `postagem_template_id = 5836c44c-0490-4f5d-8a9d-a67956c42a24`
- `proximo_avanco_em = NULL` — impede que o cron `advance-shipments` avance ou dispare e-mails/SMS depois
- `status = 'em_transito'` — mantém o envio ativo na timeline (não final)

## Garantias contra disparo de e-mail/SMS
- Não vou inserir nada em `postagem_email_log`, `confirmacao_pagamento_log`, `whatsapp_send_queue` ou `sms_*`.
- Só faço UPDATE direto na linha do envio; nenhum trigger nessa tabela enfileira e-mail (verifiquei: não há triggers em `public`).
- Ao zerar `proximo_avanco_em`, o worker que avança status + dispara comunicações ignora esses envios.

## Reversão (se precisar depois)
Basta rodar outro UPDATE restaurando `ultimo_evento_ordem` e `status_label` originais — posso salvar um snapshot antes se você quiser.

Confirma que posso executar?