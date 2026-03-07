

## Plano: Corrigir envio de Imagem e Botão Reply no WhatsApp

### Problemas identificados

1. **Imagem**: O código envia a imagem via `/send/image` com payload `{ number, url, caption }` — endpoint incorreto. A UAZAPI espera `/send/media` com `{ number, type: "image", file }`. Porém, a melhor solução é usar o campo `imageButton` do próprio `/send/menu`, que envia imagem + botões numa única mensagem.

2. **Reply button**: O `reply_text` é adicionado a um array `buttons` separado, mas a UAZAPI não tem esse campo. Botões de resposta devem ir no array `choices` (formato: `"texto"` ou `"texto|id"`).

3. **Send-queue**: Mesmo problema — não envia imagem nem reply nos disparos em massa.

### Alterações em `supabase/functions/send-whatsapp/index.ts`

#### Action `send` (linhas ~453-519)

- Remover a chamada separada a `/send/image`
- Se `image_url` existir, adicionar `imageButton: image_url` ao `sendBody`
- Se `reply_text` existir, adicionar ao array `choices` (formato: `"reply_text"`)
- Remover o array `buttons` que não existe na API

```typescript
// Antes: chamada separada /send/image + array buttons
// Depois:
const choices: string[] = [];
if (reply_text) choices.push(reply_text);
if (btn_text && btn_url) choices.push(`${btn_text}|${btn_url}`);

const sendBody: Record<string, unknown> = {
    number, type: "button", text, choices,
};
if (image_url) sendBody.imageButton = image_url;
if (footer) sendBody.footerText = footer;
```

#### Action `send-queue` (linhas ~554-648)

- Buscar `whatsapp_image_url` e `whatsapp_reply_text` do `postagem_config`
- Adicionar `imageButton` e reply ao `sendBody` de cada mensagem em massa

### Arquivos alterados
- `supabase/functions/send-whatsapp/index.ts`

