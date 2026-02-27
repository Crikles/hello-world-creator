

# Redesign da Pagina "Envios" - Command Center Futurista

## Conceito

Transformar a pagina de listagem plana em um "Centro de Comando de Envios" — um painel imersivo com cards individuais para cada envio (em vez de tabela), metricas resumidas no topo, barra de acoes com glassmorphism, e estado vazio cinematografico. Layout totalmente reorganizado.

## Nova Estrutura de Layout

```text
+----------------------------------------------------------+
|  HERO: Titulo + Metricas resumidas (4 mini-cards glass)   |
|  [Total] [Pendentes] [Em Transito] [Entregues]           |
+----------------------------------------------------------+
|  BARRA DE ACOES (glass, sticky)                           |
|  [Switch Auto] [Busca] [Filtro] | [Modelo][CSV][+Novo]   |
+----------------------------------------------------------+
|  GRID DE CARDS (2 ou 3 colunas)                           |
|  +---------------+  +---------------+  +---------------+ |
|  | Card Envio 1  |  | Card Envio 2  |  | Card Envio 3  | |
|  | Glass + Glow  |  | Glass + Glow  |  | Glass + Glow  | |
|  +---------------+  +---------------+  +---------------+ |
+----------------------------------------------------------+
```

## Elementos Visuais

### 1. Hero com Metricas
- Titulo "Centro de Envios" com glow dourado sutil
- Subtitulo descritivo
- 4 mini-cards glass lado a lado mostrando contadores: Total, Pendentes, Em Transito, Entregues
- Cada mini-card com icone, numero grande e label
- Animacao de entrada escalonada

### 2. Barra de Acoes Redesenhada
- Fundo glass-strong com borda dourada sutil
- Layout reorganizado: controles a esquerda (auto-envio, batch actions), ferramentas a direita (busca, filtro, import, novo)
- Busca com icone e fundo glass
- Botao "Novo Envio" como CTA principal com efeito shimmer
- Botoes de batch (Iniciar Pendentes, Avancar Todos) com icones dourados

### 3. Cards de Envio (substituindo tabela)
- Grid responsivo: 1 coluna mobile, 2 tablet, 3 desktop
- Cada card em glassmorphism com hover glow
- Layout interno do card:
  - Topo: Nome do cliente (bold) + badge de status com glow colorido
  - Meio: Produto, valor em destaque dourado, codigo rastreio mono
  - Barra de progresso com gradiente dourado e indicador numerico
  - Rodape: data + botoes de acao (avancar, deletar)
- Animacao stagger-in nos cards
- Indicador visual pulsante no badge de status

### 4. Estado Vazio Cinematografico
- Icone grande de caminhao com efeito de orbita (particulas girando ao redor)
- Texto motivacional: "Nenhum envio por aqui... ainda"
- CTA shimmer para criar primeiro envio

### 5. Loading State
- Skeleton cards com efeito shimmer dourado (3 cards placeholder)

## Mudancas Tecnicas

### Arquivo: `src/pages/Envios.tsx`
- Reescrever o JSX de retorno mantendo 100% da logica (hooks, queries, mutations, handlers, estados)
- Substituir Table por grid de cards
- Adicionar secao de metricas computadas a partir dos dados existentes (contadores por status)
- Usar classes CSS ja existentes: glass, glass-strong, glow-border, glow-border-hover, shimmer-btn, animate-stagger-in, animate-orbit, animate-pulse-dot, skeleton-shimmer
- Animacao de entrada com animationDelay escalonado nos cards

### Nenhuma mudanca em:
- Logica de negocio (mutations, queries, batch actions, filtros)
- Componentes filhos (ImportarPlanilha, NovoEnvioWizard)
- Componentes UI base
- CSS global (todas as classes necessarias ja existem)

## Resultado Esperado

Uma interface que parece um painel de monitoramento de operacoes logisticas premium — cards flutuantes com bordas de luz dourada, metricas em tempo real no topo, acoes de batch com visual sofisticado, e um estado vazio que impressiona em vez de parecer abandonado.

