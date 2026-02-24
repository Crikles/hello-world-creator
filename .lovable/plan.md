

# Webhook Corvex - Edge Function

## Resumo

Criar a edge function `webhook-corvex` para receber notificacoes do checkout Corvex, seguindo o padrao dos webhooks existentes (Vega/Zedy) mas mapeando os campos especificos do payload da Corvex.

---

## Diferencas Importantes da Corvex

- O campo `event` identifica o tipo de evento (ex: `corvex.order.paid`), diferente dos outros checkouts que usam apenas `status`
- O valor `amount` vem em **reais** (decimal), nao em centavos -- precisa converter para centavos (multiplicar por 100)
- O campo `client.doc` vem no formato `TIPO:NUMERO` (ex: `CPF:12345678900`) -- precisa extrair apenas o numero
- O campo `items` usa `price` em reais (nao centavos) e tem campos extras como `orderBump` e `gift`
- Suporte opcional a validacao de assinatura HMAC-SHA256 via header `X-Webhook-Signature`

---

## Mapeamento de Campos Corvex -> Pedidos

| Campo Corvex | Campo Pedidos |
|---|---|
| `id` (UUID) | `transaction_token` |
| `status` (paid/pending/refused/refunded/waiting_payment) | `status` |
| `method` (pix/card/bankslip/unknown) | `method` |
| `amount` (reais) | `total_price` (converter para centavos: amount * 100) |
| `client.name` | `customer_name` |
| `client.doc` (extrair numero apos `:`) | `customer_document` |
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

## Status e Eventos

| Evento Corvex | Status | Acao |
|---|---|---|
| `corvex.order.paid` | `paid` | Cria envio automaticamente |
| `corvex.order.created` | `pending` | Registra pedido, sem envio |
| `corvex.order.cancelled` | `refused` | Registra/atualiza pedido |
| `corvex.order.refunded` | `refunded` | Registra/atualiza pedido |
| `corvex.order.pending` | `waiting_payment` | Registra/atualiza pedido |

---

## Implementacao

### 1. Criar `supabase/functions/webhook-corvex/index.ts`

- Mesma estrutura base (CORS, validacao de `loja` query param, resolucao por slug)
- Parsear payload Corvex:
  - `id` como `transaction_token`
  - `amount * 100` como `total_price` (conversao reais para centavos)
  - Extrair documento do formato `TIPO:NUMERO` (ex: `CPF:12345678900` -> `12345678900`)
  - Normalizar `items` para o formato padrao de `products`
  - Usar `event` para determinar o `event_type` no webhook_logs
- Se `status === "paid"` e nao tem envio vinculado, criar envio automaticamente
- Log no `webhook_logs` com `checkout_provider: "corvex"`
- Country fixo como `"BR"` (nao vem no payload de address)

### 2. Sem alteracoes no banco de dados

Usa as mesmas tabelas `pedidos`, `envios` e `webhook_logs`.

---

## Detalhes Tecnicos

- URL do webhook: `{SUPABASE_URL}/functions/v1/webhook-corvex?loja={slug}`
- A validacao HMAC-SHA256 nao sera implementada neste momento (opcional segundo a doc da Corvex), podendo ser adicionada futuramente
- O campo `address.country` nao existe no payload Corvex, sera setado como `null`
- Produtos com `gift: true` ou `orderBump: true` serao incluidos normalmente no array de products

