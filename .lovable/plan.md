

## Plan: Integrar Zedy com Recuperação de Vendas (Carrinho Abandonado + PIX Pendente)

### Análise da Documentação Zedy

Os status do webhook Zedy são: `waiting_payment`, `paid`, `refused`, `refunded`.

**Mapeamento:**
- **PIX Pendente** → `status: "waiting_payment"` + `paymentMethod: "pix"`
- **Carrinho Abandonado** → `status: "waiting_payment"` + `paymentMethod != "pix"` (cartão recusado ou boleto pendente = carrinho não finalizado)

O webhook atual (`webhook-zedy`) já recebe todos os status, mas só cria envio quando `status === "paid"`. Precisamos adicionar lógica para disparar a recuperação quando `status === "waiting_payment"`.

### Alteração: `supabase/functions/webhook-zedy/index.ts`

Após o log do webhook (seção 1) e antes da normalização (seção 2), adicionar um bloco:

```text
Se status === "waiting_payment":
  1. Determinar tipo: paymentMethod inclui "pix" → "pix_pendente", senão → "carrinho"
  2. Verificar se recovery está ativo para esse tipo (tabela recovery_config)
  3. Se ativo:
     - Montar checkout_url a partir de payload.actions[0]?.url ou ""
     - Verificar duplicata (mesmo email + loja + tipo nas últimas 24h em recovery_leads)
     - Inserir lead em recovery_leads com produtos normalizados
     - Invocar send-recovery-email (fire-and-forget)
     - Invocar send-recovery-sms (fire-and-forget)
  4. Continuar o fluxo normal do webhook (upsert pedido, etc.)
```

### Detalhes técnicos

- Produtos serão mapeados de `{ name, priceInCents, quantity }` para `{ name, value (em reais), qty }`
- `total_value` será `commission.totalPriceInCents / 100`
- `checkout_url` extraído de `payload.actions[0]?.url` se disponível
- `customer_name`, `customer_email`, `customer_phone` do objeto `customer`
- O bloco de recuperação não impede o fluxo normal (upsert de pedido continua)

### Arquivo alterado
- `supabase/functions/webhook-zedy/index.ts` (apenas)
- Redeploy da edge function

