

## Plano: Ajustar webhook-zedy para recuperação de PIX pendente (sem Copia e Cola / QR Code)

### Alterações

**1. `supabase/functions/webhook-zedy/index.ts`**
- Remover o bloco de deduplicação (linhas 105-115) — o `if (!existingLead...)` que bloqueia leads repetidos do mesmo email nas últimas 24h
- Mover o código de criação do lead (linhas 116-146) para fora do `if` de deduplicação, executando sempre
- Adicionar log de diagnóstico: `console.log("[webhook-zedy] Recovery lead created:", { email, tipo, totalValue, checkoutUrl })`

**2. `supabase/functions/send-recovery-email/index.ts`**
- O email já funciona corretamente: a seção PIX (QR Code + Copia e Cola) só aparece se `vars.pix_code` existir (linha 100). Como a Zedy não fornece `pix_code`, essa seção será automaticamente omitida
- O botão CTA já usa `checkout_url` como fallback (linha 114), então aparecerá com a URL `actions[0].url` da Zedy
- Nenhuma alteração necessária neste arquivo

**3. Redeploy** da function `webhook-zedy`

### O que o email da Zedy vai conter
- Valor correto em reais
- Lista de produtos
- Botão CTA com link para o checkout
- **Sem** QR Code e **sem** Copia e Cola (comportamento automático, pois `pix_code` será vazio)

### Resultado esperado
Ao gerar um PIX na Zedy com `status: waiting_payment`, o lead será criado sem bloqueio de deduplicação, com valor correto e URL de checkout, e o email será enviado apenas com botão de pagamento funcional.

