

## Plan: Integrar Vega (V1 + V2) com Recuperação de Vendas

### Análise da Documentação

**Carrinho Abandonado:**
- V1: `status: "abandoned_cart"`, URL em `abandoned_checkout_url`, produtos em `plans[].products[]`
- V2: `status: "abandoned_cart"`, URL em `abandoned_checkout_url_url`, produtos em `products[]`

**PIX Pendente:**
- V1: `status: "pending"` + `method: "pix"`, URL em `checkout_url`
- V2: `status: "pending"` + `method: "pix"`, URL em `checkout_url`

O webhook-vega já detecta `abandoned_cart` e `pending` mas não dispara recuperação.

### Alteração: `supabase/functions/webhook-vega/index.ts`

Após o upsert do pedido (linha ~159) e antes do bloco "If approved" (linha ~162), adicionar:

```text
Se status === "abandoned_cart" OU (status === "pending" && method === "pix"):
  1. Determinar tipo:
     - "abandoned_cart" → tipo = "carrinho"
     - "pending" + pix → tipo = "pix_pendente"
  2. Extrair email do customer
  3. Se email existe:
     - Verificar recovery_config ativo para loja + tipo
     - Verificar duplicata em recovery_leads (mesmo email + loja + tipo nas últimas 24h)
     - Montar checkout_url:
       V1: payload.abandoned_checkout_url || payload.checkout_url
       V2: payload.abandoned_checkout_url_url || payload.checkout_url
     - Normalizar produtos (nome, valor em reais, qty)
     - Inserir em recovery_leads
     - Fire-and-forget: send-recovery-email e send-recovery-sms
  4. Continuar fluxo normal (não bloqueia upsert do pedido)
```

### Detalhes

- `total_value` = `totalPrice / 100` (já calculado)
- Produtos: usar `normalizedProducts` já montado, mapear `title` → `name`, `amount/100` → `value`, `quantity` → `qty`
- `checkout_url`: tentar `abandoned_checkout_url_url` (V2), `abandoned_checkout_url` (V1), `checkout_url`, `order_url`
- `customer_name`, `customer_email`, `customer_phone` do objeto `customer`

### Arquivo alterado
- `supabase/functions/webhook-vega/index.ts` (apenas)
- Redeploy da edge function

