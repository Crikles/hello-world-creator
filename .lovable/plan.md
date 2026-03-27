

## Plan: Bulk send ("Enviar Todos") deve respeitar delay e consultar fila existente

### Problema
O fluxo de envio em massa (`send-queue` no `send-whatsapp`) calcula o escalonamento a partir de `Date.now()` sem verificar itens já pendentes na fila. Se já existem mensagens agendadas (de novos pedidos ou avanços automáticos), o bulk send sobrepõe os horários, quebrando o intervalo configurado.

### Alteração

**Arquivo: `supabase/functions/send-whatsapp/index.ts` (ação `send-queue`, linhas ~631-663)**

Antes de montar os `queueItems`, buscar o último `scheduled_at` pendente da loja na `whatsapp_send_queue` (mesmo padrão que `auto-whatsapp-new-order` já faz). Usar esse valor como base do escalonamento:

```text
1. Buscar último scheduled_at pendente da loja
2. baseTime = max(now, último_scheduled_at + delaySeconds)
3. Cada item subsequente: baseTime + (i * delaySeconds)
```

Isso garante que:
- Mensagens em massa respeitam o delay entre si
- Não sobrepõem mensagens já agendadas por outros fluxos
- Intercalam instâncias via round-robin (já implementado)

### O que não muda
- `auto-whatsapp-new-order` (já consulta a fila)
- `advance-shipments` (já consulta a fila)
- Processamento do cron
- UI do WhatsApp

