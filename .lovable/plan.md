

## Remover Refresh do Preview e Colorir Dados da Empresa

### Problema 1: Refresh/flicker no preview
Quando voce digita no formulario, o iframe recebe um novo `srcDoc` a cada tecla, causando um reload completo (flash branco). A solucao e usar `useEffect` para escrever diretamente no documento do iframe via `iframe.contentWindow.document.write()`, evitando o re-render do elemento iframe.

### Problema 2: Dados da empresa com cor diferente
Os valores preenchidos pela empresa (razao social, CNPJ, endereco, etc.) ficam com uma cor destaque (azul) no preview para facilitar a visualizacao. No PDF e no envio ao comprador, tudo permanece preto padrao.

---

### Alteracoes tecnicas

**Arquivo: `src/components/danfe/DanfePreview.tsx`**

1. **Adicionar classe CSS `.empresa-value`** no HTML gerado por `buildDanfeHtml`:
   - Envolver os valores dinamicos da empresa (razao social, CNPJ, endereco, telefone, email, inscricao estadual) com `<span class="empresa-value">...</span>`
   - Adicionar no CSS: `.empresa-value { color: #2563eb; }` (azul)
   - Adicionar no `@media print`: `.empresa-value { color: #000 !important; }` para garantir preto no PDF

2. **Nenhuma mudanca na funcao `buildDanfeHtml` em si** alem de adicionar as classes CSS e spans - a logica permanece a mesma

**Arquivo: `src/pages/Empresa.tsx`**

3. **Eliminar o refresh do iframe**:
   - Remover o `srcDoc={danfeHtml}` do iframe
   - Adicionar um `useEffect` que observa `danfeHtml` e escreve o conteudo diretamente no iframe usando:
     ```
     const doc = iframe.contentWindow.document;
     doc.open();
     doc.write(danfeHtml);
     doc.close();
     ```
   - Isso atualiza o conteudo sem recarregar o iframe, eliminando o flash branco

### Resultado
- O preview atualiza suavemente conforme o usuario digita, sem piscar
- Os dados da empresa aparecem em azul no preview para destaque visual
- No PDF baixado e no envio, tudo fica em preto padrao

