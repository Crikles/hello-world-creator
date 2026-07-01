
## Integração LPQV Checkout

A LPQV envia webhooks para uma URL sua sempre que eventos acontecem (pedido criado, pago, cancelado, checkout abandonado). Vamos criar um endpoint no nosso sistema para receber esses eventos e gerar os pedidos/envios automaticamente — mesmo padrão dos outros checkouts (Cloudfy, Adoorei, Vega, etc.).

### O que será entregue

**1. Edge Function `webhook-lpqv`** em `supabase/functions/webhook-lpqv/index.ts`
- Endpoint público: `https://wzxfbejykayahnfdkdbl.supabase.co/functions/v1/webhook-lpqv?token={webhook_token_da_loja}`
- Aceita POST com JSON no formato LPQV (com `signature`, `slug-landingpage`, `response`, `event`)
- Valida assinatura HMAC-SHA1 opcional (se a loja salvar o `webhook_token` da LPQV)
- Resolve a loja pelo `token` da query string (mesmo padrão dos outros webhooks)
- Bifurca por evento:
  - `order.paid` / `payment_accept` → cria `pedido` + `envio` (status pendente) e dispara fluxo de confirmação de pagamento
  - `order.created` / `order_created` → cria `pedido` sem envio (aguardando pagamento)
  - `order.canceled` → marca pedido como cancelado
  - `checkout.abandoned` → registra na tabela de recuperação de vendas (mesmo fluxo do Cloudfy)
  - `order.updated`, `product.*` → apenas loga
- Deduplicação atômica via RPC `try_create_envio_dedupe` (padrão do projeto)
- Salva raw payload em `webhook_logs`
- Dispara `advance-shipments`, `auto-whatsapp-new-order` e `send-payment-confirmation` no final (fire-and-forget)

**2. Mapeamento de campos LPQV → nosso schema**

```
response.customer_name          → cliente_nome / customer_name
response.customer_email         → cliente_email
response.customer_cpf           → cliente_cpf
response.phone_number/cell      → cliente_telefone
response.orders_delivery_address[0]:
  recipient                     → cliente_nome (fallback)
  zip_code                      → cliente_cep
  address                       → cliente_endereco
  number                        → cliente_numero
  complement                    → cliente_complemento
  district                      → cliente_bairro
  city                          → cliente_cidade
  state                         → cliente_estado
  country                       → address_country
response.orders_products[]      → produto (JSON com nome + quantidade), quantidade total
response.payment_total          → valor (em reais)
response.token                  → transaction_token
response.id                     → referência externa
```

**3. UI em `src/pages/Integracoes.tsx`**
- Novo card "LPQV Checkout" com logo (branca sobre fundo escuro — vou salvar via lovable-assets a partir de `user-uploads://logo_white.png`)
- Copiar URL do webhook com o `webhook_token` da loja
- Instruções em português: onde criar o webhook no painel LPQV, quais eventos marcar (`order.paid`, `order.canceled`, `checkout.abandoned`, opcional `order.created`)

### Detalhes técnicos

- Assinatura HMAC-SHA1: LPQV faz `hash_hmac('sha1', json_encode(response), webhook_token)`. Vamos validar apenas se a loja tiver salvo o `lpqv_webhook_token` (novo campo opcional, ou reaproveitar campo genérico). Para simplificar na 1ª versão, faremos a validação opcional — se o campo existir na config, valida; senão, aceita apenas pelo token da URL (mesmo padrão dos demais).
- Sem migração necessária se reusarmos `webhook_token` da loja como autenticação de URL (padrão atual).
- `verify_jwt = false` já é o default em edge functions do Lovable Cloud.

### O que **não** faremos nessa etapa

- Não vamos consumir a API REST da LPQV (GET/PUT orders) — apenas recebemos webhooks. A atualização de rastreio (PUT) pode virar um passo futuro se você quiser devolver código de rastreio pra LPQV.
