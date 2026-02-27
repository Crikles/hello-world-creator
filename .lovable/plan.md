

# Redesign da Pagina "Minhas Lojas" - Visual Futurista e Sofisticado

## Visao Geral

Transformar a pagina atual (que e basicamente um header simples + grid de cards planos) em uma experiencia visual imersiva, futurista e sofisticada, mantendo 100% da logica funcional intacta (queries, mutations, dialogs, navegacao).

## Conceito de Design

Estetica "Dark Luxury Futurism": fundo com gradientes sutis e particulas/grid animado, cards com efeito glassmorphism e bordas brilhantes em dourado, animacoes suaves de entrada, tipografia com hierarquia forte, e detalhes de luz/glow que dao profundidade.

## Elementos Visuais Novos

### 1. Background Imersivo
- Gradiente radial sutil do centro (dourado escuro quase imperceptivel) para as bordas (preto puro)
- Grid de linhas finas animadas (CSS puro) criando efeito de "matrix/blueprint" no fundo
- Efeito de glow dourado sutil atras do titulo principal

### 2. Header Redesenhado
- Sem borda inferior rigida - usar backdrop-blur com fundo semi-transparente
- Logo Magnus a esquerda com efeito de brilho pulsante
- Saldo de creditos em "pill" com borda dourada e icone animado
- Botoes com estilo ghost mais refinado, com hover glow

### 3. Hero Section (novo)
- Area central com saudacao personalizada ("Bem-vindo de volta")
- Contador de lojas ativas em destaque com tipografia grande
- Subtitulo elegante com descricao
- Botao "Nova Loja" reposicionado como CTA principal com efeito de shine/shimmer na borda

### 4. Cards de Lojas - Glassmorphism
- Fundo com backdrop-blur e transparencia (glass effect)
- Borda com gradiente dourado sutil (border-image ou pseudo-element)
- Hover: borda brilha mais forte + leve scale up (1.02) + sombra dourada
- Icone da loja em circulo com anel dourado animado (rotating gradient border)
- Data de criacao com icone de calendario
- Indicador visual de "ativa" (bolinha verde pulsante)
- Animacao de entrada escalonada (staggered fade-in-up) para cada card

### 5. Estado Vazio Redesenhado
- Ilustracao com icone grande e efeito de particulas/orbitas ao redor
- Texto motivacional mais impactante
- CTA com efeito shimmer

### 6. Loading State
- Skeleton com efeito shimmer dourado em vez de spinner simples

## Mudancas Tecnicas

### Arquivo: `src/index.css`
- Adicionar keyframes CSS para:
  - `shimmer` (efeito de brilho percorrendo bordas)
  - `glow-pulse` (pulsacao suave de brilho)
  - `float` (leve flutuacao)
  - `grid-move` (animacao do grid de fundo)
  - `stagger-in` (entrada escalonada dos cards)
- Adicionar classes utilitarias:
  - `.glass` (backdrop-blur + bg transparente)
  - `.glow-border` (borda com brilho dourado)
  - `.shimmer-btn` (botao com efeito shimmer)

### Arquivo: `src/pages/Lojas.tsx`
- Reescrever apenas o JSX de retorno (template visual)
- Manter intactos: todos os hooks, queries, mutations, handlers, estados
- Adicionar as novas classes CSS e estrutura visual
- Adicionar animacao de entrada com `style={{ animationDelay }}` nos cards

### Nenhuma mudanca em:
- Logica de negocio (create, rename, delete mutations)
- Queries de dados (lojas, saldo)
- Navegacao e rotas
- Dialogs de renomear/excluir (apenas melhorar visualmente com glass effect)
- Componentes UI base (button, input, card, dialog)

## Resultado Esperado

Uma pagina que parece um painel de controle futurista premium - como se fosse a interface de um sistema de alta tecnologia. Preto profundo com acentos dourados brilhantes, cards que parecem flutuar com bordas de luz, animacoes suaves que dao vida sem distrair, e uma hierarquia visual clara que guia o olhar do usuario.

