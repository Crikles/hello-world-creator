

## Plan: Respeitar delay de WhatsApp em todos os fluxos de envio

### Problema
O `whatsapp_delay_seconds` (ex: 5 minutos) só é respeitado no disparo em massa manual (bulk queue via `send-whatsapp`). Nos outros dois fluxos — novo pedido (`auto-whatsapp-new-order`) e avanço automático (`advance-shipments`) — as mensagens são enviadas **imediatamente**, sem nenhum intervalo. Quando vários pedidos chegam juntos ou o cron processa vários envios, todas as mensagens disparam ao mesmo tempo.

### Solução
Em vez de enviar direto pela UAZAPI, ambos os fluxos passam a **enfileirar** na tabela `whatsapp_send_queue` com `scheduled_at` escalonado. O cron já processa essa fila a cada 5 minutos — basta inserir corretamente.

### Alterações

**1. `supabase/functions/auto-whatsapp-new-order/index.ts`**
- Remover o envio direto via UAZAPI (`fetch send/menu`)
- Em vez disso, calcular o `scheduled_at` baseado no último item da fila daquela loja + `whatsapp_delay_seconds`
- Inserir na `whatsapp_send_queue` com status `pending`
- Buscar `whatsapp_delay_seconds` do `postagem_config` (hoje não é lido)

**2. `supabase/functions/advance-shipments/index.ts` (linhas ~873-970)**
- Substituir o envio direto por inserção na `whatsapp_send_queue`
- Mesmo cálculo de `scheduled_at`: último item pendente da fila da loja + delay
- Manter a lógica de skip no primeiro avanço (já enviado pelo new-order)

### Lógica de escalonamento
```text
1. Buscar último scheduled_at pendente da loja na fila
2. Se não existe, usar now()
3. Novo scheduled_at = max(now(), último_scheduled_at + delay_seconds)
4. Inserir na whatsapp_send_queue
```

### O que não muda
- Processamento da fila pelo cron (já funciona)
- Disparo em massa manual (já usa a fila corretamente)
- Configuração do delay na UI (já salva `whatsapp_delay_seconds`)
- Validação de instância e fallback (feitos no processamento da fila)

