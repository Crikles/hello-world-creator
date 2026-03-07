

## Plano: Mensagem única com imagem + inverter ordem dos botões

### Mudanças

Nos dois blocos (`send` e `send-queue`):

1. **Imagem em mensagem única**: Remover o envio separado via `/send/media`. Voltar a usar `imageButton` no `/send/menu`, mas prefixar o `text` com `"\n"` quando houver imagem, para que a primeira linha (título) fique vazia e o texto completo apareça no body.

2. **Inverter ordem dos botões**: Colocar o botão de URL primeiro e o reply depois no array `choices`.

### Código (action `send`, ~linhas 464-497)

```typescript
// Remover bloco de envio separado de imagem (linhas 464-475)

// Inverter ordem: URL primeiro, reply depois
const choices: string[] = [];
if (btn_text && btn_url) choices.push(`${btn_text}|${btn_url}`);
if (reply_text) choices.push(reply_text);

const sendBody: Record<string, unknown> = {
    number, type: "button",
    text: image_url ? `\n${text}` : text,  // linha vazia como título quando tem imagem
    choices,
};
if (image_url) sendBody.imageButton = image_url;
if (footer) sendBody.footerText = footer;
```

### Código (action `send-queue`, ~linhas 601-626)

Mesma lógica: inverter choices e usar `imageButton` + `"\n"` prefix no texto.

### Arquivo alterado
- `supabase/functions/send-whatsapp/index.ts`

