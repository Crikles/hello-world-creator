

## Plano: Liberar envios atuais cancelando backlog antigo

### Problema
A loja `backupativado@gmail.com` tem ~25.767 mensagens `pending` na fila com `scheduled_at` agendado até julho/2026. Pedidos novos são agendados **depois** do último item da fila, então ficam presos no fim da fila e nunca saem.

### Solução
**Cancelar o backlog antigo** dessa loja específica para que novos pedidos passem a ser agendados a partir de agora.

### Ação técnica

**1. Cancelar mensagens pending antigas da loja `75b3b01b-7ec5-440f-81d5-e1c0a4717b57`:**
```sql
UPDATE whatsapp_send_queue
SET status = 'cancelled',
    error_reason = 'Backlog antigo cancelado para liberar envios atuais',
    processed_at = now()
WHERE loja_id = '75b3b01b-7ec5-440f-81d5-e1c0a4717b57'
  AND status = 'pending'
  AND scheduled_at > now() + interval '1 hour';
```

Isso mantém intactas:
- Mensagens já enviadas (`sent`)
- Mensagens prestes a sair (próxima 1 hora)
- Mensagens de outras lojas

**2. Resultado esperado:**
- Os 3 pedidos recentes (e qualquer novo) serão reagendados naturalmente pelo `auto-whatsapp-new-order` para os próximos slots de 5 em 5 minutos
- Como a query do `auto-whatsapp-new-order` ignora itens `cancelled`, o cálculo do próximo `scheduled_at` voltará a ser `now()` para o próximo pedido novo

**3. Verificação pós-execução:**
- Consultar a fila para confirmar que pedidos recentes ficaram com `scheduled_at` próximo do horário atual
- Acompanhar logs do cron `advance-shipments` na próxima execução (5 min)

### Observação
Os pedidos recentes JÁ inseridos na fila com `scheduled_at` em julho/2026 também precisam ser **reagendados para agora**, não apenas cancelados. Vou fazer um UPDATE adicional nesses específicos:

```sql
-- Reagendar os pedidos NOVOS (criados nas últimas 2h) para now()
UPDATE whatsapp_send_queue
SET scheduled_at = now() + (row_number_seq * interval '5 minutes')
WHERE loja_id = '75b3b01b-7ec5-440f-81d5-e1c0a4717b57'
  AND status = 'pending'
  AND created_at > now() - interval '2 hours';
```

(Será aplicado escalonadamente: primeiro item agora, segundo +5min, terceiro +10min)

### Sem alterações de código
Apenas operações de dados via insert tool. Nenhuma edge function precisa ser modificada — a lógica já está correta após os fixes anteriores.

