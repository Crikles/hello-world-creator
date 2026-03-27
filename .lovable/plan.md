

## Plan: Preview completo do email com bloco de upsell dinâmico

### O que muda

Substituir o preview isolado do bloco de upsell por um **preview completo do email** usando a mesma função `buildEmailHtml` do `emailTemplates.ts`, com o bloco de upsell injetado dentro do HTML.

### Alterações

**1. `src/components/postagens/emailTemplates.ts` — Aceitar upsell opcional no `buildEmailHtml`**
- Adicionar parâmetro opcional `upsellHtml?: string` na função `buildEmailHtml`
- Inserir o bloco entre o WhatsApp e o Footer (após `${whatsappBlock}`)
- Se `upsellHtml` for vazio/undefined, nada muda

**2. `src/pages/Upsell.tsx` — Trocar preview por email completo em iframe**
- Importar `buildEmailHtml`, `replaceVariables`, `dadosExemplo`, `defaultSectionsByEvent`
- Gerar o HTML do upsell como string (table-based, mesmo padrão do `send-email`)
- Chamar `buildEmailHtml(sections, "#6366f1", eventName, undefined, upsellHtmlString)` para montar o email completo
- Renderizar em um `<iframe>` (mesmo padrão do `EmailPreview.tsx`)
- Quando `form.ativo === false`, passar `upsellHtml` como `undefined` — o bloco some do preview
- Usar `eventName = "Postado"` para tipo `nfe` e `"Coletado"` para tipo `coletado`
- Usar `defaultSectionsByEvent["Postado"]` / `defaultSectionsByEvent["Coletado"]` como sections de exemplo

**3. Manter o `UpsellPreview` existente** como fallback visual no card de edição, mas o card de "Preview no E-mail" passa a ser o email completo.

### Comportamento
- Toggle **ativado** → email completo com bloco de upsell visível
- Toggle **desativado** → email completo sem o bloco (exatamente como o cliente receberia)
- Cores, textos e imagem atualizados em tempo real no preview

### O que não muda
- `EmailPreview.tsx` (usado em Postagens, intocado)
- `send-email/index.ts` (backend)
- Banco de dados

