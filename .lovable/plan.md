

# Corrigir Rate Limit nos Emails do Cron

## Problema

Os logs mostram que o cron ainda está gerando **RateLimitError** ao chamar `send-email`. Mesmo com `BATCH_SIZE=3`, as 3 chamadas simultâneas a `supabase.functions.invoke("send-email")` excedem o limite de invocações de funções internas. Os envios **avançam de etapa corretamente**, mas os **emails não são enviados**.

## Causa Raiz

Chamar `supabase.functions.invoke()` de dentro de outra edge function conta contra o rate limit de invocações internas. Com 3 chamadas paralelas + SMS + WhatsApp, o limite é facilmente atingido.

## Solução

Mudar para processamento **completamente sequencial** (um envio por vez) com um delay de 500ms entre cada. Isso elimina o rate limit enquanto mantém throughput suficiente.

### Cálculo de capacidade:
- 1 envio a cada ~1s (processamento + delay) = ~60 envios por execução de 60s
- 12 execuções/hora = **720 avanços/hora**
- Com 1000 pedidos/dia x ~8 etapas = ~8000 avanços/dia
- 720 x 24h = **17.280 avanços/dia** — mais que suficiente

### Mudanças em `supabase/functions/advance-shipments/index.ts`:

1. `BATCH_SIZE = 3` → `BATCH_SIZE = 1`
2. `BATCH_DELAY_MS = 1500` → `BATCH_DELAY_MS = 500`
3. Remover `Promise.allSettled` — processar sequencialmente com `await advanceShipment()` direto
4. Manter `MAX_PER_RUN = 200` e `MAX_PER_LOJA = 100`

Resultado: zero rate limits, todos os emails enviados, sistema funciona 24/7.

