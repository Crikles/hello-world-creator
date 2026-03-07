

## Plano: Corrigir extração do QR Code / Pairing Code da UAZAPI

### Causa raiz

A resposta da UAZAPI retorna QR code e pairing code **aninhados** dentro de `instance`:

```json
{
  "instance": {
    "qrcode": "base64...",
    "paircode": "V7H7-7LZJ"
  }
}
```

O código atual procura `data.qrcode` e `data.pairingCode` no nível raiz, mas os campos estão em `data.instance.qrcode` e `data.instance.paircode` (com "paircode", não "pairingCode").

### Alterações

#### Edge Function (`supabase/functions/send-whatsapp/index.ts`)

Na action `connect` (linhas ~303-317):
- Extrair corretamente: `data.instance?.qrcode` e `data.instance?.paircode`
- Salvar no banco com os valores corretos
- Retornar os valores normalizados para o frontend

```typescript
const qrCode = data.instance?.qrcode || data.qrcode || null;
const pairingCode = data.instance?.paircode || data.pairingCode || null;

// Update DB with extracted values
await supabaseAdmin.from("whatsapp_instances").update({
    status: "connecting",
    qr_code: qrCode,
    pairing_code: pairingCode,
    phone: body.phone || null,
}).eq("id", instance.id);

return jsonResp({ success: true, qrcode: qrCode, pairingCode: pairingCode });
```

Na action `status` (linhas ~330-350):
- Mesma correção: extrair de `data.instance` quando presente
- Mapear o status corretamente: `data.instance?.status` ou `data.status`

#### Frontend (`src/pages/WhatsApp.tsx`)

O `onSuccess` do `connectMutation` (linha 378-379) já procura `data.qrcode` e `data.pairingCode`, que baterão com os valores normalizados retornados pela edge function. Nenhuma alteração necessária no frontend.

### Arquivos alterados
- `supabase/functions/send-whatsapp/index.ts` — extrair dados de `data.instance`

