

## Plano: Ajustar webhook-luna para capturar PIX e atualizar Tutorial

### Diagnóstico

O payload da Luna mostra que ela **envia** dados de PIX que não estamos capturando:
- `payment.qrcode` — código Copia e Cola do PIX
- `checkout_url` — URL de checkout do cliente (já capturada)

Além disso, o webhook da Luna ainda tem **deduplicação de 24h** (linhas 173-181) que deveria ter sido removida.

### Alterações

**1. `supabase/functions/webhook-luna/index.ts`**
- Capturar `payment.qrcode` como `pix_code` no lead de recuperação
- Remover o bloco de deduplicação por email nas últimas 24h (linhas 173-181)
- Adicionar deduplicação por `transaction_token` (campo `id` do payload) para evitar reprocessamento do mesmo pedido

**2. `src/pages/RecuperacaoVendas.tsx`** — Tabela do Tutorial
- Atualizar Luna: `qrcode: false` → `qrcode: false`, `copiaECola: true`, `urlCheckout: true`
- (A Luna envia o código Copia e Cola via `payment.qrcode`, mas não envia imagem QR Code — o sistema gera a imagem automaticamente se houver `pix_code`)

Espera, na verdade o `payment.qrcode` é o código texto do PIX (copia e cola). O sistema já converte isso em QR Code imagem automaticamente no `send-recovery-email`. Então Luna suporta tanto QR Code quanto Copia e Cola.

Atualização na tabela:
- Luna: `qrcode: true`, `copiaECola: true`, `urlCheckout: true`

**3. Redeploy** da function `webhook-luna`

### Resultado esperado
- Lead de PIX pendente da Luna salvo com `pix_code` (copia e cola) e `checkout_url`
- Email enviado com QR Code, Copia e Cola e botão CTA
- Sem leads duplicados do mesmo pedido (deduplicação por transaction token)

