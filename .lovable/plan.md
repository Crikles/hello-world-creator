

## Plano: Adicionar seções extras ao site da JL Transportes (igual à Vetor)

### O que será feito

Replicar as 4 seções adicionais do site da Vetor para o site da JL Transportes, adaptando cores (indigo/dark theme) e conteúdo. Também incorporar a foto do caminhão JL enviada.

### Novas seções (inseridas entre Results e Partners, exibidas quando `!searched`)

**1. Barra de Estatísticas**
- Faixa dark com 4 métricas: "10.000+ Entregas/mês", "99% Satisfação", "24/7 Rastreamento", "6+ Transportadoras"
- Estilo indigo/dark theme

**2. "Como Funciona"**
- 3 passos: Obtenha o código → Digite no campo → Acompanhe tudo
- Fundo escuro com acentos indigo

**3. "Sobre Nós / Por que escolher a JL?"**
- Layout 2 colunas com foto do caminhão JL (`public/jl-truck.png`)
- Bullet points: Rastreamento 24h, Cobertura nacional, Simples e sem cadastro

**4. "Recursos"**
- 3 cards: Rastreamento em tempo real, Localização precisa, Histórico completo

### Alterações técnicas

- **Asset**: Copiar `user-uploads://jl.png` → `public/jl-truck.png`
- **`src/pages/Rastreio.tsx`**:
  - Inserir 4 seções JSX no bloco JL (entre hero/results e partners, condicionadas a `!searched`) usando prefixo CSS `jl-` para as novas classes
  - Adicionar CSS correspondente no `jlStyles` com media queries para mobile
  - Atualizar partner logos para usar os SVGs novos (`.svg` em vez de `.jpg`/`.png`/`.webp`)

### Responsividade
- Stats bar: 4 colunas desktop → 2x2 mobile
- Como Funciona: horizontal → vertical mobile
- Sobre Nós: 2 colunas → empilhado mobile
- Recursos: 3 colunas → 1 coluna mobile

