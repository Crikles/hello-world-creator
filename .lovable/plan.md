

## Plano: Atualizar webhook Nuvorafy conforme documentação atualizada

### Problema

A documentação atualizada da Nuvorafy confirma que os dados vêm em `payload.order` (não `payload.data`) e o campo de ID do pedido é `order.order_id` (não `order.id`). O código atual prioriza `payload.data` e não lê `order_id`.

### Alterações em `supabase/functions/webhook-nuvorafy/index.ts`

**1. Linha 78** — Inverter prioridade para `payload.order` primeiro:
```typescript
const order = payload.order || payload.data || {};
```

**2. Linha 79** — Adicionar `order.order_id` como primeira opção de ID:
```typescript
const transactionToken = String(order.order_id || order.id || order.orderId || `nuvorafy_${Date.now()}`);
```

Apenas essas 2 linhas precisam mudar. Todo o restante (campos snake_case, items, cart_items, pix_code, checkout_link) já está mapeado corretamente conforme a nova documentação.

### Resultado esperado
- Pedidos criados com `transaction_token` usando o `order_id` correto
- Dados extraídos de `payload.order` conforme a documentação oficial
- Mantém fallback para `payload.data` caso payloads antigos ainda cheguem

