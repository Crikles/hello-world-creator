

## Plan: Integrar Luna com Recuperação de Vendas (Carrinho Abandonado + PIX Pendente)

### Análise da Documentação Luna

**Mapeamento de eventos:**
- **Carrinho Abandonado** → `event: "sale_cart_abandoned"` (status: `"pending"`, method: `null`)
- **PIX Pendente** → `event: "sale_waiting_payment"` (status: `"waiting_payment"`, method: `"pix"`)

A Luna já tem os eventos mapeados no `eventTypeMap` (linhas 74-81). O `checkout_url` vem direto no payload.

### Alteração: `supabase/functions/webhook-luna/index.ts`

Após o upsert do pedido (linha ~154) e antes do bloco "If paid" (linha ~157), adicionar:

```text
Se event === "sale_cart_abandoned" OU (event === "sale_waiting_payment" && method === "pix"):
  1. Determinar tipo:
     - "sale_cart_abandoned" → tipo = "carrinho"
     - "sale_waiting_payment" + pix → tipo = "pix_pendente"
  2. Se client.email existe:
     - Verificar recovery_config ativo para loja + tipo
     - Verificar duplicata em recovery_leads (mesmo email + loja + tipo nas últimas 24h)
     - checkout_url = payload.checkout_url
     - Normalizar produtos: items[].name → name, items[].price → value, items[].quantity → qty
     - total_value = payload.amount (já em reais)
     - Inserir em recovery_leads
     - Fire-and-forget: send-recovery-email e send-recovery-sms
  3. Continuar fluxo normal
```

### Detalhes técnicos

- `checkout_url` vem direto de `payload.checkout_url`
- `total_value` = `payload.amount` (Luna já envia em reais, não em centavos)
- `customer_phone` = `client.phone` (já com DDI: 5511999999999)
- Produtos: `{ name: item.name, value: item.price, qty: item.quantity }`
- Deduplicação 24h por email + loja_id + tipo

### Arquivo alterado
- `supabase/functions/webhook-luna/index.ts` (apenas)
- Redeploy da edge function

