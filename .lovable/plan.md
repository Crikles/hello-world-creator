## Problema

Em `atlas-cargo.org/termos` e `/privacidade`, a página exibe os dados da **JL Transportes**. O motivo: `src/pages/TermosPrivacidade.tsx` só trata dois casos — `vetor` e fallback JL. O provider `atlas` (retornado por `getLogisticsProvider()` para `atlas-cargo.org`) cai no fallback JL.

## Mudança

Arquivo único: `src/pages/TermosPrivacidade.tsx`

1. Detectar `provider === "atlas"` além de `vetor`.
2. Definir os textos da marca Atlas:
   - **empresa:** `Atlas Cargo Transportes Ltda`
   - **empresaCurta:** `Atlas Cargo`
   - **site:** `atlas-cargo.org`
   - **email:** `contato@atlas-cargo.org`
3. Paleta Atlas (combinando com o visual escuro/dourado do rastreio):
   - `accent`: `#f59e0b`
   - `accentDark`: `#d97706`
   - `bgBody`: `#fffbeb`
4. Substituir o `const isVetor = ...` por uma seleção condicional por provider (`atlas` | `vetor` | default `jl`), mantendo a estrutura atual do componente. Nenhuma rota nova; conteúdo dos termos/privacidade permanece igual, só muda nome/site/email/cores.

Sem mudanças em rotas, banco ou outras páginas.