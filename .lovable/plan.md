

## Plano: Corrigir primeira linha do texto sendo "engolida" como título

### Causa raiz

Quando o `/send/menu` recebe `imageButton`, a UAZAPI automaticamente extrai a **primeira linha** do `text` e a usa como `title` (cabeçalho acima da imagem). Isso é visível na resposta da API:

```json
{
  "title": "Olá Luana Figueira! 👋",     // extraído automaticamente
  "body": { "text": "\nSeu pedido ..." }  // restante
}
```

O título aparece em fonte menor acima da imagem, dando a impressão de que sumiu.

### Solução

Quando houver `image_url`, enviar em **2 etapas**:

1. **Imagem** via `/send/media` (type: `image`, sem caption)
2. **Mensagem com botões** via `/send/menu` (sem `imageButton`), mantendo o texto completo no body

Isso garante que todo o texto aparece no corpo da mensagem, sem perda da primeira linha.

### Alterações

#### `supabase/functions/send-whatsapp/index.ts`

**Action `send`** (~linhas 464-496):
```typescript
if (image_url) {
  // Enviar imagem separada primeiro
  await fetch(`${UAZAPI_BASE}/send/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", token: instanceToken },
    body: JSON.stringify({ number, type: "image", file: image_url }),
  });
}

// Enviar mensagem com botões (SEM imageButton)
const sendBody = { number, type: "button", text, choices };
if (footer) sendBody.footerText = footer;

const res = await fetch(`${UAZAPI_BASE}/send/menu`, { ... });
```

**Action `send-queue`** (~linhas 554+): Mesma lógica — enviar imagem separada antes do menu.

### Arquivo alterado
- `supabase/functions/send-whatsapp/index.ts`

