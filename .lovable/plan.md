

## Plano: Redesign do site Vetor Transportes com mais conteúdo

### O que será feito

Adicionar 4 novas seções ao site da Vetor (entre Benefits e Partners), além de incorporar a foto do caminhão enviada. O layout será responsivo para mobile e desktop.

### Novas seções (na ordem)

**1. Barra de Estatísticas** (após o hero, antes dos benefits)
- Faixa verde escuro com 4 métricas: "10.000+ Entregas/mês", "99% Satisfação", "24/7 Rastreamento", "6+ Transportadoras"
- Ícones em cada métrica, texto branco

**2. Seção "Como Funciona"** (após benefits)
- Fundo verde escuro, 3 passos conectados por linha horizontal
- Passo 1: "Obtenha o código" — Passo 2: "Digite no campo" — Passo 3: "Acompanhe tudo"
- Números em círculos verdes com linha conectora

**3. Seção "Sobre Nós / Por que escolher a Vetor?"** (após "Como Funciona")
- Layout 2 colunas: esquerda = card escuro com texto + badge "6+ Transportadoras" + foto do caminhão; direita = 3 bullet points com ícones (Rastreamento 24h, Cobertura nacional, Simples e sem cadastro)
- A foto do caminhão será copiada para `public/vetor-truck.png` e usada nesta seção

**4. Seção "Recursos"** (após "Sobre Nós")
- Badge "RECURSOS", título "Tudo que você precisa em um só lugar"
- 3 cards: Rastreamento em tempo real, Localização precisa, Histórico completo

### Alterações técnicas

- **Arquivo**: `src/pages/Rastreio.tsx`
  - Adicionar JSX das 4 seções no bloco `isVetor` (entre Benefits e Partners, só quando `!searched`)
  - Adicionar CSS correspondente no `vetorStyles` com media queries para mobile
- **Asset**: Copiar `user-uploads://Design_sem_nome-3.png` → `public/vetor-truck.png`

### Responsividade
- Stats bar: 4 colunas desktop → 2x2 grid mobile
- Como Funciona: horizontal desktop → vertical mobile
- Sobre Nós: 2 colunas desktop → empilhado mobile
- Recursos: 3 colunas desktop → 1 coluna mobile

