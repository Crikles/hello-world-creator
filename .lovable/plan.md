

## Plano: Ajustar webhook-adoorei para recuperação de PIX pendente

### Diagnóstico

O payload da Adoorei **não envia** QR Code, Copia e Cola, nem URL de checkout do cliente. Apenas envia `payment_method: "pix"` e `status: "pending"`.

Problemas atuais no código:
1. **Deduplicação de 24h por email** (linhas 235-243) ainda ativa — precisa ser substituída por deduplicação por `transaction_token` (campo `number` do payload)
2. **`checkout_url` vazio** — correto, pois Adoorei não fornece URL de pagamento
3. **Sem `pix_code`** — correto, Adoorei não envia dados de PIX no payload

### Alterações

**1. `supabase/functions/webhook-adoorei/index.ts`**
- Remover deduplicação por email nas últimas 24h (linhas 235-243)
- Adicionar deduplicação por `transaction_token` no `raw_payload`: verificar se já existe um `recovery_lead` com `raw_payload->>'resource'` contendo o mesmo `number` para essa loja
- Manter `checkout_url` vazio e sem `pix_code` (Adoorei não fornece esses dados)

**2. `src/pages/RecuperacaoVendas.tsx`** — Tabela do Tutorial
- Confirmar que Adoorei está com `qrcode: false`, `copiaECola: false`, `urlCheckout: false`

**3. Redeploy** da function `webhook-adoorei`

### O que o email da Adoorei vai conter
- Valor correto em reais
- Lista de produtos
- **Sem** QR Code, **sem** Copia e Cola, **sem** botão CTA (igual à Zedy)

### Resultado esperado
- Sem leads duplicados do mesmo pedido (deduplicação por transaction token)
- Email da Adoorei sai apenas com informações do pedido, sem dados de pagamento PIX

