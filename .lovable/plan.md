

## Plano: Gerar QR Code PIX via API externa para Zedy

### Contexto

A Zedy envia o código Copia e Cola do PIX (`pixQrCode`) mas não envia imagem QR. Vamos usar a API pública `https://api.qrserver.com/v1/create-qr-code/` para gerar a imagem do QR Code a partir do código PIX.

### Alterações

**1. `supabase/functions/webhook-zedy/index.ts`** — No bloco de recovery (linha ~130), após capturar `payload.pixQrCode`, gerar a URL do QR Code:

```typescript
const pixCode = payload.pixQrCode || "";
const pixQrcodeUrl = pixCode 
  ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pixCode)}`
  : "";
```

E no insert do `recovery_leads`, adicionar:
```typescript
pix_qrcode_url: pixQrcodeUrl,
```

**2. `src/pages/RecuperacaoVendas.tsx`** — Atualizar Zedy na tabela para `qrcode: true`:

```typescript
{ name: "Zedy", qrcode: true, copiaECola: true, urlCheckout: false }
```

### Resultado esperado
- Leads de recuperação da Zedy terão `pix_qrcode_url` preenchido com a URL da imagem QR gerada dinamicamente
- E-mails de recuperação exibirão o QR Code + Copia e Cola
- Tabela de compatibilidade atualizada mostrando QR Code como disponível para Zedy

