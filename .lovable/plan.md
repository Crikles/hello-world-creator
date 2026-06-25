## Objetivo
Mostrar no topo do Dashboard (logo abaixo do título "Bem-vindo de volta…") um banner indicando se a loja está usando **Rastreio Nacional** ou **Rastreio Global**, com bandeiras.

## Alterações

### `src/pages/Dashboard.tsx`
- Estender a query existente `global-dashboard` para também retornar `idioma` (além de `ativo`) de `global_flow_config`.
- Adicionar um card compacto novo entre o header e a grid de stat cards:
  - Se `globalAtivo = false` → **Rastreio Nacional** com bandeira do Brasil (🇧🇷 via `https://flagcdn.com/br.svg`) e subtítulo "Envios processados pela logística nacional".
  - Se `globalAtivo = true` → **Rastreio Global** com a bandeira correspondente:
    - `idioma = "en"` → bandeira US + "Global Logistics (US)"
    - `idioma = "es"` → bandeira ES + "Logística Global (ES)"
  - Visual: card `glass glow-border rounded-2xl p-4`, flex com bandeira (h-10 w-14 rounded shadow), título e subtítulo, e badge "Ativo" à direita.

Sem alterações de backend ou banco.