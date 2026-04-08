

## Plano: Corrigir mapeamento do payload Nuvorafy

### Problema

O webhook atual lê `payload.order` mas a Nuvorafy envia os dados em `payload.data`. Os campos também usam camelCase (`customerName`, `customerEmail`, `paymentMethod`, `orderId`) em vez de snake_case.

Resultado: pedido criado com todos os campos vazios/nulos.

### Alteração em `supabase/functions/webhook-nuvorafy/index.ts`

Corrigir o mapeamento de campos:

```
// ANTES (errado)
const order = payload.order || {};
const transactionToken = String(order.id || `nuvorafy_${Date.now()}`);

// DEPOIS (correto)
const order = payload.data || payload.order || {};
const transactionToken = String(order.orderId || order.id || `nuvorafy_${Date.now()}`);
```

Corrigir os campos de cliente (camelCase):

| Campo atual (errado) | Campo correto |
|---|---|
| `order.customer_name` | `order.customerName` |
| `order.customer_email` | `order.customerEmail` |
| `order.customer_cpf` | `order.customerCpf` ou `order.customerDocument` |
| `order.customer_phone` | `order.customerPhone` |
| `order.payment_method` | `order.paymentMethod` |
| `order.shipping_address` | `order.shippingAddress` |
| `order.shipping_zip` | `order.shippingZip` |
| `order.shipping_city` | `order.shippingCity` |
| `order.shipping_state` | `order.shippingState` |
| `order.amount` | `order.amount` (valor em reais, sem multiplicar por 100 se ja vier em centavos -- validar) |

Adicionar fallbacks para ambos os formatos (camelCase e snake_case) para máxima compatibilidade.

### Resultado esperado
- Pedidos Nuvorafy criados com nome, email, telefone e endereço corretos
- `transaction_token` usa o `orderId` real em vez de timestamp
- Envios gerados com dados completos do cliente

