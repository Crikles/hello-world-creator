

## Plan: Integrar Corvex com Recuperação de Vendas (PIX Pendente + Carrinho Abandonado)

### Análise da Documentação Corvex

**Mapeamento de eventos:**
- **PIX Pendente** → `event: "corvex.order.pending"` ou `"corvex.order.created"` com `status: "pending"` e `method: "pix"`
- **Carrinho Abandonado** → `event: "corvex.order.created"` com `status: "pending"` e `method != "pix"` (cartão pendente/recusado = carrinho não finalizado)

Nota: A Corvex não tem evento dedicado de "carrinho abandonado". O mais próximo é `corvex.order.created` com status `pending` e método não-pix, ou `corvex.order.cancelled`/`refused`.

**Campos relevantes:**
- `amount` já em reais (decimal)
- `client.email`, `client.name`, `client.phone`
- `items[].name`, `items[].price`, `items[].quantity`
- Não há `checkout_url` no payload — o campo `utm.page.url` pode servir como fallback

### Alteração: `supabase/functions/webhook-corvex/index.ts`

Após o upsert do pedido (linha ~160) e antes do bloco "If paid" (linha ~162), adicionar:

```text
Se (event === "corvex.order.created" && status === "pending") OU event === "corvex.order.pending":
  1. Determinar tipo:
     - method inclui "pix" → tipo = "pix_pendente"
     - senão → tipo = "carrinho"
  2. Se client.email existe:
     - Verificar recovery_config ativo para loja + tipo
     - Verificar duplicata em recovery_leads (mesmo email + loja + tipo nas últimas 24h)
     - checkout_url = payload.utm?.page?.url || ""
     - Normalizar produtos: items[].name → name, items[].price → value, items[].quantity → qty
     - total_value = payload.amount (já em reais)
     - Inserir em recovery_leads
     - Fire-and-forget: send-recovery-email e send-recovery-sms
  3. Continuar fluxo normal (não bloqueia upsert/envio)
```

### Detalhes técnicos

- `total_value` = `payload.amount` (Corvex envia em reais)
- `checkout_url` = `payload.utm?.page?.url` (melhor opção disponível, já que Corvex não envia checkout_url explícito)
- Produtos: `{ name: item.name, value: item.price, qty: item.quantity }`
- Deduplicação 24h por email + loja_id + tipo
- Mesmo padrão já usado nos webhooks Zedy, Vega e Luna

### Arquivo alterado
- `supabase/functions/webhook-corvex/index.ts` (apenas)
- Redeploy da edge function

