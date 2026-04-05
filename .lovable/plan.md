

## Plano: Adicionar seção PIX (QR Code + Copia e Cola) no preview do email

### O que será feito
Quando o tipo for `pix_pendente`, o preview do email na página de Recuperação exibirá uma seção de PIX entre o resumo do pedido e o texto de interrupção, contendo:
1. Imagem do QR Code (placeholder de exemplo)
2. Código Copia e Cola em destaque (fundo cinza, fonte mono)
3. O botão CTA já existente continuará funcionando normalmente

### Alterações

**`src/pages/RecuperacaoVendas.tsx`**

1. Adicionar parâmetro `tipo` na função `buildEmailHtml(s, empresaNome, logoUrl, tipo)`
2. Dentro de `buildEmailHtml`, após a seção `mostrar_resumo_pedido` e antes de `mostrar_texto_interrupcao`, inserir uma seção PIX condicional quando `tipo === "pix_pendente"`:
   - QR Code: imagem placeholder (quadrado cinza com ícone PIX ou texto "QR Code PIX")
   - Copia e Cola: bloco com fundo `#f1f5f9`, borda `#e2e8f0`, fonte monospace, exibindo um código PIX de exemplo
   - Texto auxiliar: "Escaneie o QR Code ou copie o código abaixo"
3. Atualizar a chamada `buildEmailHtml(settings, empresaNome, logoUrl)` no `useMemo` do `previewHtml` para passar o `tipo` como parâmetro
4. No preview, o código PIX de exemplo será estático (texto fixo de demonstração)

### Resultado esperado
O preview do email de PIX pendente mostrará visualmente a seção de QR Code e Copia e Cola, refletindo o que o cliente final receberá no email real.

