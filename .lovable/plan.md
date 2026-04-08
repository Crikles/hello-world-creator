

## Plano: Corrigir mapeamento do webhook Nuvorafy conforme documentação oficial

### Problema

O código atual na linha 78 prioriza `payload.data` sobre `payload.order`:
```typescript
const order = payload.data || payload.order || {};
```

A documentação oficial confirma que os dados vêm em `payload.order` com campos em **snake_case** (`customer_name`, `customer_email`, `shipping_address`, etc.) e que `items` contém os produtos. O mapeamento anterior foi baseado em suposições incorretas.

Além disso, o `amount` é sempre em **reais** (ex: `149.90`), não em centavos. A lógica atual `rawAmount <= 1000` é frágil e incorreta.

### Alterações em `supabase/functions/webhook-nuvorafy/index.ts`

1. **Linha 78** — Priorizar `payload.order`:
```typescript
const order = payload.order || payload.data || {};
```

2. **Linha 79** — Usar `order.id` como primário (a doc mostra `id` como UUID):
```typescript
const transactionToken = String(order.id || order.orderId || `nuvorafy_${Date.now()}`);
```

3. **Linhas 86-93** — Priorizar snake_case nos campos:
```typescript
const customerName = order.customer_name || order.customerName || null;
const customerEmail = order.customer_email || order.customerEmail || null;
const customerDocument = order.customer_cpf || order.customerCpf || order.customer_document || null;
const customerPhone = order.customer_phone || order.customerPhone || null;
const shippingAddress = order.shipping_address || order.shippingAddress || null;
const shippingZip = order.shipping_zip || order.shippingZip || null;
const shippingCity = order.shipping_city || order.shippingCity || null;
const shippingState = order.shipping_state || order.shippingState || null;
```

4. **Linha 94** — Adicionar `shipping_method` como fallback de método de pagamento:
```typescript
const rawPaymentMethod = (order.payment_method || order.paymentMethod || "").toLowerCase();
```

5. **Linha 111** — Amount é sempre reais, converter para centavos:
```typescript
const totalPrice = Math.round(rawAmount * 100);
```

6. **Adicionar `orderNumber`** para fallback de produto quando `items` vazio:
```typescript
const orderNumber = order.order_number || order.orderNumber || "";
```
E no `produtoJson`, se `items` vazio, usar `Pedido ${orderNumber}`.

### Resultado esperado
- Pedidos Nuvorafy criados com todos os dados (nome, email, CPF, telefone, endereço, produtos)
- Valores convertidos corretamente de reais para centavos
- Produtos listados pelo nome real do item

