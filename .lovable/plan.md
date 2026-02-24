

# Webhook Zedy - Edge Function

## Resumo

Criar a edge function `webhook-zedy` para receber notificaciones do checkout Zedy, seguindo o mesmo padrao do `webhook-vega` mas mapeando os campos especificos do payload da Zedy.

---

## Mapeamento de Campos Zedy -> Pedidos

| Campo Zedy | Campo Pedidos |
|---|---|
| `orderId` | `transaction_token` |
| `status` (paid/waiting_payment/refused/refunded) | `status` |
| `paymentMethod` | `method` |
| `commission.totalPriceInCents` | `total_price` (ja em centavos) |
| `customer.name` | `customer_name` |
| `customer.document` | `customer_document` |
| `customer.email` | `customer_email` |
| `customer.phone` | `customer_phone` |
| `address.street` | `address_street` |
| `address.number` | `address_number` |
| `address.neighborhood` | `address_district` |
| `address.zipcode` | `address_zip_code` |
| `address.city` | `address_city` |
| `address.state` | `address_state` |
| `address.country` | `address_country` |
| `address.complement` | `address_complement` |
| `products` | `products` (array normalizado) |

## Status Mapping

| Zedy Status | Acao |
|---|---|
| `paid` | Cria envio automaticamente (equivalente ao "approved" do Vega) |
| `waiting_payment` | Registra pedido, sem criar envio |
| `refused` | Registra/atualiza pedido |
| `refunded` | Registra/atualiza pedido |

## Implementacao

### 1. Criar `supabase/functions/webhook-zedy/index.ts`

- Mesma estrutura do webhook-vega (CORS, validacao de `loja` query param, resolucao de loja por slug)
- Parsear payload Zedy com campos especificos:
  - `orderId` como transaction_token
  - `commission.totalPriceInCents` como total_price (sem conversao, ja esta em centavos)
  - `products` array com campos `id`, `name`, `quantity`, `priceInCents`
  - Ignorar pedidos de teste (`isTest === true`)
- Log no `webhook_logs` com `checkout_provider: "zedy"`
- Upsert no `pedidos` com `checkout_provider: "zedy"`
- Se `status === "paid"` e nao tem envio vinculado, criar envio automaticamente
- Marcar webhook como processado

### 2. Atualizar `supabase/config.toml`

- Adicionar `[functions.webhook-zedy]` com `verify_jwt = false` para permitir chamadas externas

---

## Detalhes Tecnicos

- Nenhuma alteracao no banco de dados necessaria (usa as mesmas tabelas `pedidos`, `envios`, `webhook_logs`)
- A URL do webhook sera: `{SUPABASE_URL}/functions/v1/webhook-zedy?loja={slug}`
- Pedidos com `isTest: true` serao ignorados para nao poluir dados reais
