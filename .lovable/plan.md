

# Simplificar integracao Shopify para webhook-only

## Contexto

O payload recebido pela "Shopify" segue o mesmo formato dos outros checkouts (Zedy, Corvex, etc.), nao e o formato nativo da Shopify. Portanto, a integracao complexa com OAuth (`shopify-auth-callback`) e HMAC verification nao e necessaria.

## Alteracoes

### 1. Reescrever `supabase/functions/shopify-webhook/index.ts`

Substituir completamente pelo mesmo padrao dos outros webhooks (Zedy/Corvex), mapeando os campos do payload:

- `customer.name/email/phone/document` -> dados do cliente
- `address.street/number/city/state/zip_code/district/complement` -> endereco
- `products[].title/amount/quantity/code` -> produtos (amount em centavos)
- `total_price` -> valor total (em centavos, dividir por 100 no envio)
- `transaction_token` ou `sale_code` -> identificador da transacao
- `status` -> "pending", "paid", etc.
- `method` -> metodo de pagamento

Fluxo:
1. Receber POST com `?loja=slug`
2. Resolver loja pelo slug
3. Logar webhook em `webhook_logs` com `checkout_provider: "shopify"`
4. Normalizar payload e upsert em `pedidos`
5. Se status "paid" e sem envio vinculado, buscar `empresa_id` e criar envio
6. Marcar webhook como processado

### 2. Remover `supabase/functions/shopify-auth-callback/index.ts`

Essa edge function nao sera mais necessaria, pois nao ha fluxo OAuth.

### 3. Remover entrada do `shopify-auth-callback` no `supabase/config.toml`

Remover a secao `[functions.shopify-auth-callback]`.

### 4. Interface de integracoes (opcional/futuro)

A configuracao de Shopify na UI pode ser simplificada para mostrar apenas a URL do webhook (`/functions/v1/shopify-webhook?loja=SEU_SLUG`), sem campos de Client ID/Secret/OAuth.

---

## Mapeamento do payload

```text
Payload field              -> DB field (pedidos)
--------------------------------------------------
transaction_token          -> transaction_token
sale_code                  -> (alternativo se token vazio)
status                     -> status
method                     -> method
total_price                -> total_price (ja em centavos)
customer.name              -> customer_name
customer.email             -> customer_email
customer.phone             -> customer_phone
customer.document          -> customer_document
address.street             -> address_street
address.number             -> address_number
address.district           -> address_district
address.zip_code           -> address_zip_code
address.city               -> address_city
address.state              -> address_state
address.country            -> address_country
address.complement         -> address_complement
products[]                 -> products (normalizado)
```

## Resultado

- Webhook Shopify funcionara igual aos demais (Zedy, Corvex, Luna, Vega)
- URL do webhook: `.../functions/v1/shopify-webhook?loja=SEU_SLUG`
- Sem necessidade de configurar App, OAuth ou credenciais Shopify
- Pedidos e envios criados automaticamente ao receber status "paid"

