

## Corrigir Layout Bugado da DANFE

### Problema Real

O `table-layout: fixed` com colunas de 14-15% esta forcando cada coluna a ter largura fixa proporcional ao container. Como o iframe esta dentro de um `col-span-5` com `scale(0.85)`, as colunas ficam muito estreitas, causando quebra de texto e linhas cortadas em todas as secoes.

### Solucao

**Arquivo: `src/components/danfe/DanfePreview.tsx`**

Remover `table-layout: fixed` e o `<colgroup>` da tabela. Em vez disso, definir uma **largura fixa em pixels** (680px) no `<table>` e no `<body>`. Isso faz o navegador calcular automaticamente a largura ideal de cada coluna com base no conteudo, sem distorcer.

Mudancas especificas no CSS e HTML gerado por `buildDanfeHtml`:

1. **CSS**: Trocar `table { width: 100%; table-layout: fixed; }` por `table { width: 680px; }` e `body { width: 700px; }`
2. **HTML**: Remover o bloco `<colgroup>` inteiro (linhas 93-101)
3. **CSS**: Manter `overflow-wrap: break-word` nas celulas para textos longos
4. **Manter** a classe `.truncate-cell` para a razao social do transportador

Isso garante que independente do tamanho do container externo, a DANFE sempre renderiza com 680px de largura total e colunas proporcionais ao conteudo.

