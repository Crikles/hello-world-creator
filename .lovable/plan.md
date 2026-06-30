## Objetivo

Refazer `src/pages/LandingPage.tsx` em um formato **Terminal / Data-room** — visual técnico, denso, ao vivo — completamente diferente do padrão DiaLog. Destacar no hero principal: **"Menos de R$2 por envio · Sem plano mensal · Envios ilimitados"**.

## Direção visual

- **Tema:** Noir & Gold mantido, mas com tratamento "command center": fundo `#0a0a0a`, grid de fundo sutil, monospace para dados, serif (Instrument Serif) só nas manchetes-chave, sans (Inter/Geist) no corpo.
- **Acentos:** dourado `#c9a84c` para destaques, verde `#22c55e` para status "ao vivo", vermelho discreto `#ef4444` para variações negativas.
- **Densidade:** alta — tickers, mini-gráficos, logs rolando, contadores incrementando.

## Nova arquitetura de seções (ordem totalmente diferente da atual)

```text
1. TopBar terminal       → relógio ao vivo · status "SYSTEM ONLINE" · logo Magnus
2. HERO PREÇO            → manchete gigante "< R$2 / envio" + sub "sem mensalidade · ilimitado"
                           ao lado: painel com 3 KPIs ao vivo (pedidos hoje, lojas ativas, países)
3. Ticker de pedidos     → faixa horizontal rolando: "#48211 PAID · BR→US · Shopify · 14:22:08"
4. Data-room dashboard   → grande painel central com gráfico 6 meses + tabela de eventos + mapa
                           (substitui o DashboardMock atual, mais denso e "trader-style")
5. Bandeiras + rotas     → BR / US / ES com linhas conectando + métricas por rota
6. Grid de integrações   → checkout logos em cards monoespaçados estilo "connected nodes"
7. Logística stack       → Atlas / Jetline / Global ES / Global US como "nodes" do sistema
8. Comparativo de preço  → tabela densa: Magnus vs concorrentes (mensalidade, custo/envio, limite)
9. Console de features   → lista estilo terminal com `> feature_name ... [ENABLED]`
10. CTA final            → bloco preto com a manchete de preço repetida + botões para magnusfrete.net
11. Footer técnico       → links + "build 2026.06 · uptime 99.98%"
```

## Componentes novos (inline no mesmo arquivo)

- `TerminalTopBar` — relógio ao vivo + status pulsando
- `PriceHero` — manchete editorial + painel lateral de KPIs animados (count-up)
- `OrdersTicker` — marquee CSS infinito com pedidos fake plausíveis
- `DataRoomPanel` — substitui `DashboardMock`/`FakeChart`: grid de 4 painéis (gráfico 6M, eventos recentes, mapa de rotas, distribuição por checkout)
- `RoutesMap` — SVG simples com BR/US/ES e linhas pulsando
- `PriceCompareTable` — tabela densa comparando Magnus (R$1,89 / sem mensalidade / ilimitado) vs faixas típicas do mercado
- `FeatureConsole` — lista monospace com prompt `>` e tags `[ENABLED]`/`[LIVE]`

## Conteúdo de preço (hero)

- Manchete: **"Menos de R$ 2,00 por envio"**
- Sub 1: **"Sem plano mensal."**
- Sub 2: **"Envios ilimitados."**
- Microcopy: "Você só paga pelo que envia. Sem mínimos, sem assinatura, sem surpresa."

## Botões

Mantém apontamento externo para `https://magnusfrete.net/login` e `/signup` (já configurado).

## Fontes

Adicionar `@fontsource/jetbrains-mono` para o visual terminal (mantendo Instrument Serif + Inter já instalados). Configurar `font-mono` no tailwind.

## Fora de escopo

- Não mexer em rotas, auth, backend.
- Não alterar `TermosUso.tsx`.
- Manter `lp.magnusfrete.net` como domínio.

## Detalhes técnicos

- Reescrever `src/pages/LandingPage.tsx` por completo (arquivo único, componentes internos).
- Tokens de cor adicionados via classes Tailwind já existentes + utilitários inline quando preciso (gold já tokenizado).
- Animações: CSS puro (keyframes para ticker, pulse, count-up via `useEffect` + `requestAnimationFrame`).
- Sem novas dependências além do `@fontsource/jetbrains-mono`.
