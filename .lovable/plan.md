

## Corrigir Layout da DANFE, Lag ao Digitar e PDF Incompleto

### Problemas Identificados

1. **Tabela bugada / linhas desalinhadas**: A tabela usa 7 colunas sem larguras fixas definidas. Quando textos longos (como "Trans Prada Zibe Transportes e Logistica LTDA") entram, as colunas se expandem de forma irregular, quebrando o alinhamento visual.

2. **Lag ao digitar**: A cada tecla pressionada, o sistema reconstroi todo o HTML da DANFE e reescreve o iframe inteiro com `doc.write()`. Isso e muito pesado e causa travamento.

3. **PDF incompleto**: O iframe tem escala de 0.85 aplicada via CSS transform, o que faz o `html2canvas` capturar o conteudo cortado ou em tamanho errado.

---

### Solucao

**Arquivo: `src/components/danfe/DanfePreview.tsx`**

1. **Definir larguras fixas para as 7 colunas** usando `<colgroup>` no inicio da tabela:
   - Colunas com porcentagens fixas (ex: 14% cada ou distribuicao proporcional) para garantir que a tabela nao mude de layout conforme o conteudo
   - Adicionar `table-layout: fixed` na tabela junto com `word-wrap: break-word` e `overflow-wrap: break-word` nas celulas
   - Diferente da tentativa anterior, agora cada coluna tera largura explicita via `<col>`, impedindo distorcao

2. **Truncar textos longos** nas celulas criticas (como razao social do transportador) com `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` apenas onde necessario, ou reduzir o font-size do valor para caber

**Arquivo: `src/pages/Empresa.tsx`**

3. **Adicionar debounce de 300ms** na atualizacao do iframe:
   - Criar um estado `debouncedHtml` separado do `danfeHtml`
   - Usar `setTimeout` / `clearTimeout` em um `useEffect` para so atualizar o iframe 300ms apos a ultima tecla
   - Isso elimina o lag ao digitar, pois o iframe so atualiza quando o usuario para de digitar

4. **Corrigir captura do PDF**:
   - Antes de capturar com `html2canvas`, remover temporariamente o CSS transform (scale 0.85) do container
   - Capturar o iframe em tamanho original (100%) para garantir que nada seja cortado
   - Restaurar o transform apos a captura

---

### Detalhes Tecnicos

**Colgroup para a tabela (DanfePreview.tsx)**:
```html
<colgroup>
  <col style="width:14%">
  <col style="width:14%">
  <col style="width:14%">
  <col style="width:14%">
  <col style="width:14%">
  <col style="width:15%">
  <col style="width:15%">
</colgroup>
```

**Debounce (Empresa.tsx)**:
```typescript
const [debouncedHtml, setDebouncedHtml] = useState(danfeHtml);

useEffect(() => {
  const timer = setTimeout(() => setDebouncedHtml(danfeHtml), 300);
  return () => clearTimeout(timer);
}, [danfeHtml]);

// useEffect que escreve no iframe usa debouncedHtml em vez de danfeHtml
```

**CSS ajustado (DanfePreview.tsx)**:
```css
table { border-collapse: collapse; width: 100%; table-layout: fixed; }
td, th { border: 1px solid #000; padding: 3px 5px; vertical-align: top; 
         overflow-wrap: break-word; word-wrap: break-word; }
```

### Resultado Esperado
- Colunas da DANFE com largura estavel, sem distorcer ao preencher dados
- Digitacao fluida sem travamento
- PDF completo sem cortes

