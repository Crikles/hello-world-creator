## Objetivo

Criar uma landing page sofisticada da Magnus Frete (estilo Noir & Gold luxo) que será hospedada em `lp.magnusfrete.net`, mais uma página de Termos de Uso adaptada ao contexto Magnus. Sem cara de IA, copy 100% original, mock funcional do dashboard.

## Rotas

- `/` (em domínio Magnus) → renderiza a nova `LandingPage`.
- `/termos-de-uso` → nova página com o texto adaptado.
- Domínios de logística (atlas-cargo.org, jetline, trackmaster) continuam intactos.
- O subdomínio `lp.magnusfrete.net` será adicionado pelo usuário no painel de domínios depois do deploy; o app já trata como Magnus automaticamente (via `isMagnusDomain` — adicionarei `lp.magnusfrete.net` na allowlist).

## Identidade visual (Noir & Gold)

- Paleta: `#0d0d0d` background, `#1a1a1a` surfaces, `#c9a84c` dourado primário, `#f0d78c` dourado claro, `#8a8a8a` muted.
- Tipografia: **Instrument Serif** (display, hero/headings) + **Inter** (body) — instaladas via `@fontsource`.
- Tokens adicionados em `index.css` (variáveis HSL) e expostos no `tailwind.config.ts` — sem cor hardcoded em componente.
- Acabamentos: linhas finas douradas, sombras profundas, grão sutil, gradientes radiais discretos atrás do hero, sem glassmorphism genérico.

## Estrutura da Landing (`src/pages/LandingPage.tsx`)

```text
┌──────────────────────────────────────────────────┐
│ NAV (logo Magnus | Termos | Entrar | CTA dourado)│
├──────────────────────────────────────────────────┤
│ HERO                                             │
│  Eyebrow: "Logística inteligente · BR · US · ES" │
│  H1 serif gigante (2 linhas)                     │
│  Subhead + 2 CTAs                                │
│  Bandeiras BR/US/ES com micro-stats              │
├──────────────────────────────────────────────────┤
│ DASHBOARD MOCK (réplica fiel do print)           │
│  - Cards: Total/Pendentes/Em Trânsito/Entregues  │
│  - Gráfico de faturamento (Recharts)             │
│  - Painel "Canais de Notificação" lateral        │
├──────────────────────────────────────────────────┤
│ NÚMEROS DO MÊS (counters grandes animados)       │
├──────────────────────────────────────────────────┤
│ RECURSOS (6 cards: Rastreio próprio, Multi-      │
│  transportadora, NF simplificada, Automação,     │
│  Dashboard, Internacional)                       │
├──────────────────────────────────────────────────┤
│ AUTOMAÇÃO (split: copy + mock notificações       │
│  email/SMS/WhatsApp)                             │
├──────────────────────────────────────────────────┤
│ INTEGRAÇÕES (carrossel infinito com TODOS os     │
│  checkouts: Shopify, Cloudfy, Zedy, Vega,        │
│  Luna, Adoorei, Corvex, Alphazz, Nuvorafy)       │
├──────────────────────────────────────────────────┤
│ CTA FINAL (dourado, contraste alto)              │
├──────────────────────────────────────────────────┤
│ FOOTER (institucional + redes + copyright)       │
└──────────────────────────────────────────────────┘
```

Animações: framer-motion para reveal-on-scroll, contador animado nos números, carrossel infinito CSS puro para integrações. Sem efeitos exagerados.

## Página de Termos (`src/pages/TermosUso.tsx`)

Reaproveita o layout já existente em `TermosPrivacidade.tsx` mas com:
- Marca Magnus Frete, paleta dourada.
- 9 seções adaptadas (Objeto, Natureza do Serviço, Responsabilidade, NF Simplificada, Créditos, Bloqueio, Alterações, Aceitação, Cooperação & Canal de Denúncias).
- Email de denúncias: `denuncias@magnusfrete.net` (confirmar com você se for outro).
- Links: voltar para `/`, ver `/privacidade`.

## Detalhes técnicos

- Arquivos novos:
  - `src/pages/LandingPage.tsx`
  - `src/pages/TermosUso.tsx`
  - `src/components/landing/` (Hero, DashboardMock, FeaturesGrid, IntegrationsMarquee, CTASection, LandingNav, LandingFooter)
- `src/App.tsx`: adicionar rotas `/` (condicionada a domínio Magnus) e `/termos-de-uso`. A rota `/` atual já é gated por `isMagnusDomain`; vou apontá-la para a landing quando o usuário NÃO estiver logado, e manter redirect para `/dashboard` se estiver logado.
- `src/lib/domain-config.ts`: adicionar `lp.magnusfrete.net` à `MAGNUS_DOMAINS`.
- `index.css`: novos tokens `--gold`, `--gold-soft`, `--noir`, `--noir-elevated`, `--gold-glow` (gradient), `--shadow-noir`.
- `tailwind.config.ts`: registrar fontes (`serif: ['Instrument Serif']`) e cores semânticas.
- `bun add @fontsource/instrument-serif @fontsource/inter` + imports em `src/main.tsx`.
- Logos de checkout: usar emojis/letras estilizadas em cards dourados (sem buscar PNGs novos para evitar visual inconsistente) OU SVG mínimos inline com o nome — confirmar abaixo.
- SEO: `<title>` "Magnus Frete — Logística & Rastreamento Inteligente", meta description, OG tags via react-helmet ou tags diretas no head do componente.

## Fora de escopo (não vou mexer)

- Não altero lógica de autenticação, fluxos globais, edge functions ou banco.
- Não toco em `TermosPrivacidade.tsx` (página dos sites de logística).
- Não configuro DNS de `lp.magnusfrete.net` — você adiciona depois no painel.

## Pontos a confirmar antes de eu começar

1. **Email do canal de denúncias** para os Termos: uso `denuncias@magnusfrete.net` ou outro?
2. **Logos dos checkouts**: prefere (a) badges tipográficos elegantes (texto estilizado em cards dourados) ou (b) eu busco/gero ícones SVG simples para cada um?
3. **Rota `/`**: quando o visitante já está logado e acessa `magnusfrete.net/`, deve (a) continuar mostrando a landing ou (b) redirecionar direto para `/dashboard`?
