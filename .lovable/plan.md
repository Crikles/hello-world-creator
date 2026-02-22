

## Aumentar Preview e Corrigir PDF Bugado

### Problema 1: Preview pequeno
O preview da DANFE precisa ocupar mais espaco para melhor leitura.

### Problema 2: PDF bugado
O `jsPDF.html()` nao consegue renderizar corretamente o HTML complexo da DANFE (tabelas com bordas, estilos inline). O resultado sai com texto sobreposto e layout quebrado, como mostrado no print.

### Solucao

**Arquivo: `src/pages/Empresa.tsx`**

1. **Aumentar o preview**: Mudar scale de `0.72` para `0.85`, altura do container de `820px` para `1020px`, e ajustar width/height do wrapper para `117.6%` (100/0.85). Iframe height para `1300px`.

2. **Corrigir download do PDF**: Substituir `jsPDF.html()` por uma abordagem usando `window.print()` no iframe. Isso usa o motor de renderizacao nativo do navegador que respeita perfeitamente o CSS/tabelas, gerando um PDF fiel ao preview. A tecnica consiste em:
   - Chamar `iframe.contentWindow.print()` que abre o dialogo nativo de impressao/salvar como PDF
   - Isso garante que o layout fique identico ao que o usuario ve no preview

**Arquivo: `src/components/danfe/DanfePreview.tsx`**

3. **Mesma correcao de PDF** no modal de tela cheia: substituir `jsPDF.html()` por `iframe.contentWindow.print()`.

4. **Adicionar CSS de impressao** ao HTML gerado pelo `buildDanfeHtml`: incluir `@media print` com margens adequadas e `@page { size: A4; margin: 10mm; }` para garantir que o PDF gerado via print fique bem formatado em A4.

### Resultado
- Preview visivelmente maior e mais legivel
- PDF gerado sera identico ao que aparece na tela, sem bugs de layout
