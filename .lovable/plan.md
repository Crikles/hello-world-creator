## Problema

`src/lib/domain-config.ts` usa uma **allowlist de domínios de logística**. Qualquer host fora dessa lista (incluindo variações como subdomínio errado, host inesperado, ou um match que falhe por capitalização/whitespace) cai no fallback **PanelRoutes** (painel Magnus). Isso é arriscado: basta um host de logística não previsto para o lead ver a Magnus.

## Solução: inverter a lógica para allowlist da Magnus

A Magnus só deve aparecer em domínios explicitamente conhecidos. Tudo o mais é tratado como rota pública de rastreio.

### Mudanças em `src/lib/domain-config.ts`

1. Adicionar `MAGNUS_DOMAINS` (allowlist restrita):
   - `magnusfrete.net`, `www.magnusfrete.net`
   - hosts internos do Lovable: qualquer host terminando em `.lovable.app` e `localhost` / `127.0.0.1` (para preview/dev)
2. Adicionar `isMagnusDomain()` baseado nessa allowlist (normaliza com `toLowerCase().trim()` e checa `endsWith` para `.lovable.app`).
3. Atualizar `isLogisticsDomain()` para retornar `!isMagnusDomain()` — ou seja, **qualquer domínio que não seja Magnus comprovada vira logística**.
4. Manter `getLogisticsProvider()` com mapeamento explícito por host (atlas/vetor/jl); adicionar fallback `'atlas'` quando o host contém `atlas` mas não bate exatamente (proteção extra para `www.` futuros, subdomínios, etc. específicos de atlas-cargo.org).

### Mudança em `src/App.tsx`

Nenhuma mudança estrutural — apenas se beneficia da nova lógica invertida. `logistics ? <LogisticsRoutes /> : <PanelRoutes />` continua igual, mas agora o "default seguro" é logística, não painel.

### Defesa extra no `PanelRoutes`

Adicionar um guard no topo de `PanelRoutes()` que, se por qualquer motivo `isMagnusDomain()` for `false`, renderiza `<Rastreio />` em vez do painel. Camada redundante caso a checagem em `App` falhe.

## Resultado

- atlas-cargo.org / www.atlas-cargo.org → sempre `LogisticsRoutes` com provider `atlas`.
- Qualquer host desconhecido → também cai em logística (nunca expõe a Magnus).
- Magnus continua acessível apenas em `magnusfrete.net`, `www.magnusfrete.net`, previews `.lovable.app` e localhost.

## Validação

- Confirmar via `window.location.hostname` (console) que atlas-cargo.org rota `/` carrega `Rastreio`.
- Confirmar que `magnusfrete.net/lojas` continua acessando o painel normalmente.
- Confirmar que preview `id-preview--*.lovable.app` continua mostrando o painel para desenvolvimento.

## Escopo

Apenas frontend: `src/lib/domain-config.ts` e um pequeno guard em `src/App.tsx`. Sem mudanças em backend, schema, edge functions ou rotas existentes.
