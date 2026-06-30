## Ajustes na Landing Page (`src/pages/LandingPage.tsx`)

### 1. Logo da Magnus Frete
- Substituir o badge "M" do header pelo arquivo `/logo-magnus.png` (já existe em `public/`, usado em Login/Signup/Sidebar).
- Manter o wordmark "Magnus·Frete" ao lado, ou removê-lo se a logo já contiver o nome — confirmar com você no preview.

### 2. Ícones reais das bandeiras (BR / US / ES)
- Trocar os emojis 🇧🇷🇺🇸🇪🇸 (que renderizam como texto monocromático em alguns sistemas) por SVGs de bandeiras coloridas via `flagcdn.com` (`https://flagcdn.com/br.svg`, `us.svg`, `es.svg`).
- Exibir em formato circular ou retângulo com borda dourada sutil, mantendo o layout atual (label + nota ao lado).

### 3. Logos reais dos checkouts integrados
- Substituir o monograma de uma letra (atual "A", "N", "R"...) pelos PNGs já existentes em `src/assets/`:
  - Shopify → `logo-shopify.png`
  - Cloudfy → `logo-cloudfy.png`
  - Zedy → `logo-zedy.png`
  - Vega V1/V2 → `logo-vega.png`
  - Luna → `logo-luna.png`
  - Adoorei → `logo-adoorei.png`
  - Corvex → `logo-corvex.ico`
  - Alphazz → `logo-alphazz.png`
  - Nuvorafy → `logo-nuvorafy.png`
- Para Recovery, Resend e Magnus API (sem asset) mantenho monograma estilizado em card dourado como fallback consistente.
- Cards do marquee passam a exibir logo em quadrado branco translúcido + nome.

### 4. Ajuste de números
- No bloco "Numbers Strip", trocar `Envios processados / mês` de **3.200+** para **50.000+** (renderizado pelo `AnimatedNumber` como "50.000+").
- No `DashboardMock` (preview de painel), atualizar os stats fictícios para refletir o novo volume:
  - Total de Pedidos: `3.200` → `52.480`
  - Em Trânsito: `3.200` → `48.120`
  - Entregues: `2.847` → `46.905`
  - (Mantém estética do print original do dashboard, só escalando os números.)

### Técnico
- Único arquivo alterado: `src/pages/LandingPage.tsx`.
- Sem novas dependências (bandeiras via CDN público, logos via imports relativos de `src/assets/`).
- Sem mudanças em rotas, backend ou design tokens.