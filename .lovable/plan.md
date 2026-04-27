## Plano — Globo CDN-Style adaptado ao nicho de logística

Substituir o globo atual (`logistics-globe.tsx`) por uma nova versão baseada no `cobe-globe-cdn`, **adaptada à identidade do projeto** (preto/dourado, dark theme já usado no Live View) e com **terminologia do nicho de rastreio logístico** em vez de "req/s" e "iad1/sfo1".

### Adaptações de conteúdo (vocabulário do nicho)

Substituições para o que é mostrado nos labels do globo:

| Original (CDN) | Substituído por (Logística) |
|---|---|
| `iad1`, `sfo1`, `cdg1`, `hnd1`… (códigos de PoP) | Nome curto da cidade real do visitante (ex.: `São Paulo`, `Rio`, `Lisboa`, `Miami`) |
| `420k req/s` (tráfego) | `N rastreios` ou `N visitantes` — número real de sessões ativas naquela cidade vindas do hook |
| Markers fixos hardcoded | **Markers dinâmicos** vindos de `useLiveVisitorsRealtime` (já agregados por cidade) |
| Arcs hardcoded entre PoPs | Arcs dinâmicos: origem da loja (cidade configurada em `postagem_config.cidade_origem`) → cada cidade visitante (top N) |

### Adaptação visual

- **Tema escuro** (o template original é claro — vamos inverter): `dark: 1`, `baseColor: [0.1, 0.2, 0.4]`, `glowColor` azulado, `markerColor` esmeralda — mantendo a paleta atual do Live View.
- **Cor dos arcs e markers**: dourado/esmeralda para combinar com o resto do app, em vez do preto puro do template.
- Remover a animação de pirâmide rotativa (estética CDN/Vercel) e usar um **dot pulsante** simples, mais coerente com "visitante ativo".
- Background transparente para se integrar com o card escuro já existente em `LiveView.tsx`.

### Mudanças técnicas

1. **`src/components/ui/logistics-globe.tsx`** — reescrita:
   - Migrar para a estrutura do `GlobeCdn` (drag/pause, anchor positioning para labels HTML sobre o canvas, `markers` + `arcs` props).
   - Aceitar nova interface:
     ```ts
     interface LogisticsGlobeProps {
       markers: { id: string; location: [number, number]; city: string; count: number }[];
       arcs?:   { id: string; from: [number, number]; to: [number, number] }[];
       className?: string;
     }
     ```
   - Renderizar **labels HTML por cima do canvas** com:
     - Nome da cidade (`São Paulo`)
     - Contador (`3 rastreios` se >1, `1 visitante` se =1)
   - Animação suave de fade/blur quando o marker rotaciona para fora da face visível (mesma técnica de CSS Anchor do template).
   - Manter pause em `visibilitychange` (já existente).

2. **`src/pages/LiveView.tsx`**:
   - Adaptar o mapeamento `globeMarkers` para o novo formato (incluir `city` e `count`).
   - Construir `arcs` opcionalmente: origem fixa (centro do Brasil ou cidade da loja, se disponível) → top 10 cidades de `markers`.
   - Manter o card/layout atual sem mudanças.

3. **Dependência `cobe`** — já está instalada (usada hoje), nenhuma instalação nova.

### Itens fora do escopo (não tocar)

- Lógica de coleta de pings (`rastreio-info`, `live_view_pings`, RLS) — intacta.
- Hook `useLiveVisitorsRealtime` — intacto, apenas o consumo dos `markers` muda.
- Tabela de atividade, métricas e isolamento por loja — intactos.

### Resultado esperado

Globo escuro estilo Cobe/Vercel no card do Live View, girando suavemente, com **labels reais** flutuando sobre as cidades dos visitantes (ex.: "São Paulo · 4 rastreios"), arcs sutis ligando a origem da loja às cidades de destino, tudo alimentado em tempo real e isolado por loja.