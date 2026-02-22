

## Redesign da Pagina Empresa - Layout Side-by-Side com DANFE em Tempo Real

### Conceito

Transformar a pagina de Empresa em um layout de duas colunas:
- **Coluna esquerda**: Formulario com os dados da empresa (logo, dados fiscais, endereco) com visual mais sofisticado usando gradientes sutis e cards com bordas coloridas
- **Coluna direita (sticky)**: Preview da DANFE em tempo real, atualizando automaticamente conforme o usuario digita

Isso elimina a necessidade de clicar em "Pre-visualizar NFE" - a nota fica sempre visivel ao lado.

---

### 1. Layout e Visual

**Estrutura principal**: Grid de 2 colunas (`grid-cols-5` ou `grid-cols-12`) onde:
- Formulario ocupa ~55% (esquerda)
- Preview DANFE ocupa ~45% (direita, `sticky top-4`)

**Melhorias visuais no formulario**:
- Fundo da pagina com gradiente sutil (de `slate-50` para `blue-50/30`)
- Cards com borda esquerda colorida (azul para dados, verde para endereco, violeta para logo)
- Inputs com foco azul mais pronunciado e fundo levemente acinzentado
- Secao de logo com area de drag-and-drop visual mais bonita (borda tracejada, icone grande)
- Header da pagina com gradiente e descricao mais visual
- Badge "Nacional (BR)" estilizado
- Botoes de acao com gradientes sutis

**Preview DANFE (coluna direita)**:
- Card com sombra elevada e borda sutil
- Header "Pre-visualizacao da NFE" com badge "Tempo Real"
- iframe com a DANFE reduzida (scale transform para caber)
- Botao "Baixar PDF" sempre visivel abaixo do preview
- Atualiza em tempo real conforme o formulario muda (ja funciona pois o `form` state e passado diretamente)

---

### 2. Detalhes Tecnicos

**Arquivos a modificar**:

- `src/pages/Empresa.tsx` - Redesign completo:
  - Layout grid 2 colunas
  - Cards com bordas coloridas laterais
  - Area de upload de logo mais visual (drag-and-drop style)
  - Preview DANFE inline (nao mais em modal) na coluna direita com `position: sticky`
  - Manter o modal como opcao para tela cheia, mas o preview inline e o padrao
  - Botoes de acao reorganizados

- `src/components/danfe/DanfePreview.tsx` - Exportar a funcao `buildDanfeHtml` e as interfaces para reutilizacao:
  - Exportar `buildDanfeHtml`, `EmpresaData`, `EnvioData`
  - Manter o componente Dialog para uso em tela cheia quando necessario

**Nenhuma alteracao no banco de dados** - apenas visual/frontend.

---

### 3. Detalhes do Design

**Header da pagina**:
- Titulo "Dados da Empresa" com subtitulo e badge em linha
- Fundo com gradiente sutil de azul

**Card Logo** (borda esquerda violeta):
- Area grande de upload com icone centralizado e borda tracejada
- Preview da logo com overlay de acoes (alterar/remover)

**Card Dados Fiscais** (borda esquerda azul):
- Campos com labels mais discretos e placeholders informativos
- Grid responsivo

**Card Endereco** (borda esquerda verde):
- Layout grid 3 colunas para endereco
- Select de UF estilizado

**Coluna Direita - Preview**:
- Card com header "Nota Fiscal (Preview)" e badge verde "Tempo Real"
- DANFE renderizada em escala reduzida (~70%) via CSS `transform: scale(0.7)` dentro de container com overflow hidden
- Botoes "Baixar PDF" e "Ver em Tela Cheia" abaixo
- Sticky para acompanhar scroll do formulario

