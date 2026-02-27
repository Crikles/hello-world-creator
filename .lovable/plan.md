

# Redesign Futurista - Empresa e Integracoes

## 1. Pagina Empresa (`src/pages/Empresa.tsx`)

### Mudancas Visuais
- **Hero Header**: Substituir o banner gradient atual por um bloco `glass glow-border` com titulo "Configuracao Fiscal", subtitulo e badge "Nacional" com estilo premium
- **Cards de Formulario**: Trocar os `Card` padrao com `border-l-4` por cards com classes `glass glow-border` e `animate-stagger-in` com delays escalonados
- **Icones**: Manter Building2, MapPin, ImagePlus mas envolve-los em containers `bg-primary/10 rounded-xl` com glow sutil
- **Inputs**: Adicionar estilo `glass` nos campos (bg transparente com borda sutil)
- **Logo Upload**: Area de upload com borda `border-primary/30` e hover com `glow-border`
- **Preview DANFE (coluna direita)**: Card com `glass glow-border`, badge "Tempo Real" com `animate-pulse-dot`, botoes de acao com `shimmer-btn`
- **Botoes de Acao**: "Salvar" como `shimmer-btn`, "Limpar" como outline glass
- **Animacoes**: Entrada escalonada nos cards do formulario

### Logica Preservada
- 100% da logica: queries, mutations, upload de logo, busca CEP, geração DANFE, download PDF
- Nenhuma mudanca em componentes filhos (DanfePreview)

---

## 2. Pagina Integracoes (`src/pages/Integracoes.tsx`)

### Mudancas Visuais
- **Hero Section**: Titulo "Central de Integracoes" com subtitulo descritivo em bloco glass
- **Metricas**: Mini-cards glass mostrando total de integracoes ativas vs inativas
- **Cards de Checkout**: Glassmorphism com `glow-border-hover` e `animate-stagger-in`
  - Logo do checkout com fundo `glass` e borda dourada sutil
  - Badge de status (Ativo/Inativo) com `animate-pulse-dot` quando ativo
  - Webhook URL em bloco `glass` com botao de copiar estilizado
  - Switch com label redesenhado
- **Carregamento Instantaneo de Imagens**: Adicionar `loading="eager"` e `decoding="sync"` nas tags `<img>` dos logos para garantir carregamento imediato sem delay. Tambem adicionar `fetchPriority="high"` para priorizar o download

### Logica Preservada
- Toggle de ativacao, copia de webhook, geracao de URL com slug da loja

---

## Detalhes Tecnicos

### Arquivos Modificados
1. `src/pages/Empresa.tsx` - Redesign completo do JSX, manter toda logica
2. `src/pages/Integracoes.tsx` - Redesign completo do JSX, manter toda logica, fix de loading das imagens

### Classes CSS Utilizadas (ja existentes)
- `glass`, `glass-strong`, `glow-border`, `glow-border-hover`
- `shimmer-btn`, `animate-stagger-in`, `animate-pulse-dot`, `animate-orbit`

### Fix de Imagens (Integracoes)
As imagens dos checkouts vao usar atributos nativos do HTML para carregamento prioritario:
```text
<img loading="eager" decoding="sync" fetchPriority="high" ... />
```
Isso elimina o delay visual que ocorre quando o browser aplica lazy loading padrao.

