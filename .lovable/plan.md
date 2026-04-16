

## Plano: Corrigir delay entre envios WhatsApp

### Problema identificado

Existem **dois problemas** na lógica atual:

1. **Processamento ignora o delay**: O cron `advance-shipments` busca TODOS os itens da fila com `scheduled_at <= now` e envia com apenas **500ms** de intervalo (linha 610). Quando o cron roda (a cada 5 min), se 20 mensagens têm `scheduled_at` no passado, todas são disparadas de uma vez com 500ms entre elas — ignorando o delay de 5 minutos configurado.

2. **Race condition no agendamento automático**: A função `auto-whatsapp-new-order` é chamada para cada envio novo. Se vários pedidos chegam simultaneamente (ex: webhook batch), todas as invocações paralelas consultam o mesmo `lastQueued` e calculam o mesmo `scheduled_at` — resultando em mensagens agendadas para o mesmo horário.

### Solução

**1. `advance-shipments` — Respeitar delay no processamento**
- Alterar a lógica de processamento da fila para enviar **apenas 1 mensagem por loja por execução do cron** (ou respeitar o delay real entre envios)
- Após enviar uma mensagem de uma loja, pular as demais dessa loja até a próxima execução do cron
- Manter o `scheduled_at` como filtro principal, mas agrupar por `loja_id` e processar apenas o item com `scheduled_at` mais antigo de cada loja

**2. `auto-whatsapp-new-order` — Corrigir race condition**
- Buscar o último item da fila (qualquer status, não apenas `pending`) para calcular o próximo `scheduled_at`, evitando que invocações concorrentes vejam o mesmo "último item"
- Considerar também itens recém-inseridos (últimos 30 min) com status `pending` ou `sent`

**3. `send-whatsapp` (envio manual em lote) — Já está correto**
- A lógica de stagger (linha 683: `baseTime + i * delaySeconds * 1000`) já escalona corretamente cada item
- Nenhuma alteração necessária nesta função

### Alterações técnicas

**Arquivo: `supabase/functions/advance-shipments/index.ts`**
- Seção "PROCESS WHATSAPP SEND QUEUE" (linhas 465-623):
  - Agrupar itens pendentes por `loja_id`
  - Para cada loja, processar apenas **1 item** (o de `scheduled_at` mais antigo)
  - Após processar, os demais itens dessa loja serão processados na próxima execução do cron (5 min depois)
  - Remover o delay fixo de 500ms (não é mais necessário pois só envia 1 por loja)

**Arquivo: `supabase/functions/auto-whatsapp-new-order/index.ts`**
- Alterar a query do `lastQueued` para incluir status `sent` e `pending` (não apenas `pending`), limitado às últimas 2h
- Isso garante que mesmo com invocações concorrentes, o cálculo do `scheduled_at` considere mensagens já enviadas recentemente

### Fluxo corrigido

```text
Automático (novos pedidos):
  Pedido 1 → auto-whatsapp → scheduled_at = now
  Pedido 2 (2s depois) → auto-whatsapp → scheduled_at = now + 5min
  Pedido 3 (3s depois) → auto-whatsapp → scheduled_at = now + 10min

Cron (a cada 5 min):
  Busca pending + scheduled_at <= now
  Agrupa por loja → envia 1 por loja
  Próxima execução → envia a próxima de cada loja

Manual (TODOS):
  send-whatsapp → escalona com baseTime + i*delay
  Cron processa 1 por loja a cada 5 min
```

### Deploy
- Redeploy de `advance-shipments` e `auto-whatsapp-new-order`

