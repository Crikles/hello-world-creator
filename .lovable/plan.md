

## Plan: Integrar Shopify com Recuperação de Vendas (PIX Pendente)

### Análise do Payload

O payload enviado ao webhook Shopify tem estrutura similar ao Vega, com campos como `customer`, `products`, `method`, `status`, `order_url`, `transaction_token`, `total_price` (em centavos).

**Mapeamento:**
- **PIX Pendente** → `status === "pending"` e `method === "pix"` (campo `method` do payload)
- **Carrinho Abandonado** → Não há evento de carrinho abandonado neste payload. Apenas PIX pendente será tratado.

O código atual já lê `payload.financial_status` para o status. O campo `method` vem de `payload.payment_gateway_names?.[0]`, mas o payload real tem `payload.method`. Ambos serão verificados.

### Alteração: `supabase/functions/shopify-webhook/index.ts`

Após o upsert do pedido (linha ~149) e antes do bloco "If paid" (linha ~152), adicionar:

```text
Se status === "pending" e (method inclui "pix" OU payload.method inclui "pix"):
  1. tipo = "pix_pendente"
  2. Se customerEmail existe:
     - Verificar recovery_config ativo para loja + tipo
     - Deduplicação 24h em recovery_leads por email + loja + tipo
     - checkout_url = payload.order_url || ""
     - Normalizar produtos: normalizedProducts[].title → name, amount/100 → value, quantity → qty
     - total_value = totalPrice / 100
     - Inserir em recovery_leads
     - Fire-and-forget: send-recovery-email e send-recovery-sms
  3. Continuar fluxo normal
```

### Detalhes técnicos

- `checkout_url` = `payload.order_url` (presente no payload)
- `total_value` = `totalPrice / 100` (já calculado em centavos)
- `customer_phone` = `payload.customer.phone` (já extraído)
- Produtos: `{ name: p.title, value: p.amount / 100, qty: p.quantity }`
- `method` será verificado tanto em `payload.payment_gateway_names?.[0]` quanto em `payload.method`
- Mesmo padrão dos webhooks Zedy, Vega, Luna, Corvex e Adoorei

### Arquivo alterado
- `supabase/functions/shopify-webhook/index.ts` (apenas)
- Redeploy da edge function

