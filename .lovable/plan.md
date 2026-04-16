

## Diagnóstico

**Estado atual da fila** (loja `backupativado@gmail.com`):
- 28 pending, mas só **1** está pronto (`scheduled_at <= now()`)
- Os outros 27 estão escalonados de 19:36 até **21:11 UTC**
- Cron `advance-shipments` está rodando normalmente (acabou de enviar 1 às 19:31)

**Causa raiz:**
Os 11 itens antigos que reescalonamos antes (de `2026-04-02`) ocuparam os slots 19:21→20:16. Quando os pedidos novos chegaram (19:17~19:30), o `auto-whatsapp-new-order` calculou `scheduled_at` baseado no último item da fila — então cada novo pedido foi empilhado a partir de **20:21, 20:26, 20:31...**, ficando até 1h30 no futuro.

A lógica está funcionando, só que a janela de 2h olha pendentes ainda no futuro e empilha por cima.

## Solução

**Reescalonar os 28 pending** para começarem agora, mantendo a regra dos 5 minutos entre eles, na ordem de criação:

```sql
WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY created_at ASC) - 1 AS pos
  FROM whatsapp_send_queue
  WHERE loja_id = '75b3b01b-7ec5-440f-81d5-e1c0a4717b57'
    AND status = 'pending'
)
UPDATE whatsapp_send_queue q
SET scheduled_at = now() + (ranked.pos * interval '5 minutes')
FROM ranked WHERE q.id = ranked.id;
```

Resultado: o primeiro envia no próximo cron (até 5 min), e os 27 seguintes a cada 5 min. Total ~2h25 para drenar.

## Por que vai parar de acontecer

O comportamento do `auto-whatsapp-new-order` está correto — ele empilha em sequência. O problema só aconteceu agora porque tínhamos um "buraco" entre o último envio real e os 11 itens antigos reescalonados. Depois que essa fila drenar normalmente, novos pedidos serão agendados sempre próximos do `now()`.

## Sem alterações de código

Apenas operação de dados (UPDATE via migration, pois precisa de write access).

