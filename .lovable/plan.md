
## Plano: Adicionar dados PIX à recuperação da Zedy

### Contexto

O payload da Zedy no status `waiting_payment` contém o campo `pixQrCode` com o código Copia e Cola do PIX. Atualmente o webhook ignora esse dado e insere o lead com `checkout_url` e `pix_code` vazios.

### Alterações

**1. `supabase/functions/webhook-zedy/index.ts`** — No bloco de recovery (linha ~130), adicionar `pix_code` ao insert do lead:

```typescript
pix_code: payload.pixQrCode || "",
```

O campo `pix_qrcode_url` ficará vazio — a edge function `send-recovery-email` já possui lógica de auto-reparo que gera a imagem QR a partir do `pix_code` quando `pix_qrcode_url` está vazio.

**2. `src/pages/RecuperacaoVendas.tsx`** — Atualizar a linha da Zedy na tabela de checkouts:

```typescript
// De:
{ name: "Zedy", qrcode: false, copiaECola: false, urlCheckout: false }
// Para:
{ name: "Zedy", qrcode: false, copiaECola: true, urlCheckout: false }
```

QR Code fica `false` porque a Zedy não envia imagem QR (apenas o texto), mas o sistema gera automaticamente via auto-reparo. Copia e Cola fica `true` porque o campo `pixQrCode` está disponível.

### Resultado esperado
- Leads de recuperação da Zedy terão o código PIX Copia e Cola preenchido
- E-mails de recuperação incluirão a seção de Copia e Cola do PIX
- A imagem QR será gerada automaticamente pelo sistema de auto-reparo no `send-recovery-email`
- Tabela de compatibilidade atualizada
