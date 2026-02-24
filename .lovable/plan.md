

# Webhook Luna - Edge Function

## Resumo

Criar a edge function `webhook-luna` para receber notificacoes do checkout Luna, seguindo o padrao dos webhooks existentes (Vega/Zedy/Corvex).

---

## Semelhancas com Corvex

A Luna tem um payload muito similar ao da Corvex:
- Usa `client` (nao `customer`) com `doc`, `name`, `email`, `phone`
- Usa `items` (nao `products`) com `price` em reais (decimal como string)
- Usa `amount` em reais (decimal como string)
- Usa `event` para identificar o tipo de evento
- Usa `address` com `neighborhood` (nao `district`)

---

## Diferencas da Luna vs Corvex

- O `amount` e `price` vem como **string** (ex: `"99.99"`), nao como number
- O `client.doc` vem como numero direto (ex: `"00000000000"`), sem prefixo `TIPO:`
- O `id` e um numero/string simples, nao UUID
- O campo `event` usa prefixo `event_sale_` (ex: `event_sale_paid`)
- Suporte a evento `sale_cart_abandoned` (carrinho abandonado)
- Campos `quantity` e `price` em items vem como **string**

---

## Mapeamento de Campos Luna -> Pedidos

| Campo Luna | Campo Pedidos |
|---|---|
| `id` | `transaction_token` |
| `status` | `status` |
| `method` (pix/card/bankslip) | `method` |
| `amount` (string em reais) | `total_price` (converter para centavos: parseFloat * 100) |
| `client.name` | `customer_name` |
| `client.doc` | `customer_document` |
| `client.email` | `customer_email` |
| `client.phone` | `customer_phone` |
| `address.street` | `address_street` |
| `address.number` | `address_number` |
| `address.neighborhood` | `address_district` |
| `address.zipcode` | `address_zip_code` |
| `address.city` | `address_city` |
| `address.state` | `address_state` |
| `address.complement` | `address_complement` |
| `items` | `products` (array normalizado) |

---

## Eventos e Status

| Evento Luna | Status | Acao |
|---|---|---|
| `event_sale_paid` | `paid` | Cria envio automaticamente |
| `event_sale_pending` | `pending` | Registra pedido, sem envio |
| `event_sale_waiting_payment` | `waiting_payment` | Registra pedido, sem envio |
| `event_sale_refused` | `refused` | Registra/atualiza pedido |
| `sale_cart_abandoned` | `abandoned_cart` | Registra pedido, sem envio |

---

## Implementacao

### 1. Criar `supabase/functions/webhook-luna/index.ts`

- Mesma estrutura base (CORS, validacao de `loja` query param, resolucao por slug)
- Parsear payload Luna:
  - `id` como `transaction_token` (prefixar com `luna_` se necessario)
  - `parseFloat(amount) * 100` como `total_price` (string reais para centavos)
  - `client.doc` direto como `customer_document` (sem necessidade de extrair)
  - Normalizar `items`: converter `price` (string) para centavos e `quantity` (string) para numero
  - Usar `event` para determinar o `event_type` no webhook_logs
- Se `status === "paid"` e nao tem envio vinculado, criar envio automaticamente
- Log no `webhook_logs` com `checkout_provider: "luna"`
- `address_country` sera `null` (nao vem no payload)

### 2. Sem alteracoes no banco de dados

Usa as mesmas tabelas `pedidos`, `envios` e `webhook_logs`.

---

## Detalhes Tecnicos

- URL do webhook: `{SUPABASE_URL}/functions/v1/webhook-luna?loja={slug}`
- Conversao de tipos: `amount` e `items[].price` sao strings, precisam de `parseFloat()` antes de multiplicar por 100
- `items[].quantity` tambem e string, precisa de `parseInt()`
- O evento `sale_cart_abandoned` nao cria envio, apenas registra o pedido

