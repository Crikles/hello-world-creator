# Live View — Painel de Visitantes em Tempo Real

Página que mostra, em tempo real, quantos clientes finais estão consultando os links de rastreio do lojista, com globo 3D interativo e métricas vivas. Por enquanto usa **dados simulados** (mock), com interface pronta para trocar por WebSocket/Realtime no futuro.

## Onde a página vive

Para seguir o padrão multi-loja existente (todas as páginas operacionais ficam sob `/loja/:lojaId/...`), a rota será:

- `/loja/:lojaId/live-view`

E aparecerá no menu lateral, dentro da seção **"Operações"**, com ícone `Activity` e label **"Live View"** — entre "Envios" e "Postagens".

> Observação: nada será adicionado fora do escopo da loja. Se quiser uma versão global futura, podemos discutir depois.

## Estrutura visual

### Header
- Título "Live View" + ponto verde pulsante "AO VIVO"
- Subtítulo: "Visitantes rastreando suas encomendas em tempo real"
- Badge à direita: "Atualizado há Xs"
- Botão "Pausar atualizações" (toggle)
- Toggle de som (padrão DESLIGADO)

### Grid principal (responsivo)
- **Desktop (≥1024px):** 40% métricas | 60% globo
- **Tablet (768–1024px):** globo no topo, cards 2x2 abaixo
- **Mobile (<768px):** tudo empilhado, globo `aspect-square`

### Coluna de métricas (4 cards)
Cada card: fundo escuro com `backdrop-blur`, borda sutil, hover azul, número grande em `font-mono`, sparkline minimalista embaixo (recharts).

1. **Visitantes Online Agora** — `Users`
2. **Códigos Sendo Rastreados** — `Package`
3. **Países Ativos** — `Globe2`
4. **Pico nas Últimas 24h** — `TrendingUp`

Números animam suavemente quando mudam (interpolação manual com `useEffect`/`requestAnimationFrame`, sem dependência nova).

### Globo 3D (centro)
Componente `LogisticsGlobe` em `src/components/ui/logistics-globe.tsx`, usando a lib **`cobe`**:
- Tema escuro, base azul-marinho, marcadores verde-neon, arcos azul claro
- Drag para girar, auto-rotação 0.004, pausa ao interagir
- Auto-resize via `ResizeObserver`, `devicePixelRatio` capado em 2
- Recebe `markers` via props (lista de visitantes)
- Lazy-loaded com `React.lazy` + `Suspense` (skeleton)

Legenda flutuante no canto inferior:
- 🟢 Visitante ativo
- 🔵 Rota de tráfego

### Tabela "Atividade ao Vivo" (abaixo do globo)
- Últimas 20 entradas: Tempo | Localização | Código | Status | Ação
- Linhas novas entram com fade-in/slide-down (Tailwind `animate-in`)
- Linha mais recente com highlight verde que desbota em ~3s
- Em mobile, vira cards empilhados

## Hook de dados (mock)

`src/hooks/useLiveVisitors.ts`:
- Mantém entre 15–80 visitantes simultâneos
- Adiciona/remove a cada 2–4s usando `setInterval`
- Cidades sorteadas de uma lista fixa de hubs (10 BR + Miami + Lisboa)
- Códigos fake `BR` + 9 dígitos
- Throttle: no máximo um update a cada 2s
- **Pausa quando `document.visibilityState !== 'visible'`** (listener no hook)
- Suporta flag externa `paused` (botão "Pausar atualizações")
- Retorna: `{ visitors, totalOnline, activeCountries, recentActivity, peak24h, lastUpdateAt }`
- Limita a 50 marcadores no globo (agrega por cidade quando excede)

Interface estável para trocar por Supabase Realtime ou WebSocket depois sem mexer na UI.

## Performance

- Rota `/live-view` carregada via `React.lazy` (chunk separada) no `App.tsx`
- Globo lazy + Suspense com skeleton
- Sem Three.js / Mapbox / Leaflet — só `cobe` (~10kb)
- Pausa total (animação + intervals) com aba oculta
- Atualizações no máx. a cada 2s

## Arquivos

**Novos:**
- `src/pages/LiveView.tsx`
- `src/components/ui/logistics-globe.tsx`
- `src/components/live-view/MetricCard.tsx` (card + sparkline + counter animado)
- `src/components/live-view/LiveActivityTable.tsx`
- `src/hooks/useLiveVisitors.ts`

**Editados:**
- `src/App.tsx` — adicionar `<Route path="live-view" element={<LiveView />} />` dentro de `/loja/:lojaId`, com `lazy()`
- `src/components/layout/AppSidebar.tsx` — adicionar item "Live View" (`Activity`) na seção Operações

**Dependência nova:** `cobe`

## Detalhes & restrições

- TypeScript estrito, componentes pequenos
- Tema escuro (slate-950/zinc-900) com acentos azul (#3B82F6) e verde-neon (#10B981) **apenas dentro desta página** — não toca no tema global preto/dourado do sistema
- Tooltips nos marcadores (cidade + contagem) via overlay HTML posicionado sobre o canvas (cálculo simples lat/lng → projeção 2D do `cobe`)
- Sem backend / sem migrations — tudo client-side com mock
- Sem som por padrão; quando ligado, usa um beep curto via `AudioContext` (sem arquivo externo)
