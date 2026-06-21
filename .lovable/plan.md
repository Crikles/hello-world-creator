# Plano: Separar sites de logística em outro projeto Lovable

## Contexto

Hoje este projeto serve duas coisas no mesmo código:
- **Painel Magnus Frete** (magnusfrete.net) — onde os lojistas administram envios.
- **Sites públicos de rastreio das transportadoras** (atlas-cargo.org, vetortransportesltda.com, jltransportelogistica.com, etc.) — selecionados em `src/lib/domain-config.ts` e renderizados pelas rotas `LogisticsRoutes` (Rastreio, Pagamento de taxação, Falha de entrega, Termos).

Você quer mover só os sites de logística para outra conta Lovable, mantendo os dados (envios, pagamentos PIX, eventos, configurações de empresa/loja) vindos do banco atual.

## Estratégia recomendada: 2 projetos, 1 banco compartilhado

O novo projeto na outra conta vai **ler e gravar no mesmo Lovable Cloud (Supabase)** deste projeto. Assim qualquer envio/pagamento criado pelos lojistas no painel Magnus aparece imediatamente no site de rastreio, e vice-versa.

Não dá pra "conectar" Lovable Cloud de um projeto ao banco de outro pela UI da Lovable. A forma suportada é o novo projeto rodar como **client externo** apontando para a URL e a chave pública (anon) deste projeto — exatamente como um site React qualquer se conecta a um Supabase. Isso funciona porque tudo que os sites de logística usam é leitura/escrita controlada por RLS e pelas edge functions públicas (`rastreio-info`, `pagamento-info`, `falha-info`, `create-pix-payment`, `check-pix-payment`, `cancel-pix-payment`, `redirect`).

### O que vai pra conta nova

Conteúdo de `LogisticsRoutes` + dependências:
- Páginas: `Rastreio`, `Pagamento`, `PagamentoFalha`, `Taxacao`, `FalhaEntrega`, `TermosPrivacidade`
- `src/lib/domain-config.ts` (allowlist de domínios da logística — sem Magnus)
- Componentes UI usados por essas páginas (shadcn, logos em `public/`)
- Assets: `public/logo-*.svg`, imagens da Atlas/Vetor
- `index.html`, Tailwind, configs

### O que NÃO vai

- Todo o painel (`/lojas`, `/loja/:id/...`, `/admin/*`, AuthContext, LojaContext, integrações de checkout, dashboard, etc.)
- Edge functions de gestão (advance-shipments, send-email, send-sms, backup, etc.)

### Como o novo projeto fala com o banco atual

No novo projeto **não** ativar Lovable Cloud. Em vez disso, criar um cliente Supabase manual apontando para este projeto:

```ts
// src/integrations/data/client.ts (no novo projeto)
import { createClient } from "@supabase/supabase-js";
export const supabase = createClient(
  "https://wzxfbejykayahnfdkdbl.supabase.co",
  "<ANON KEY pública deste projeto>"
);
```

A chave anon é pública por design e já está no `.env` deste projeto (`VITE_SUPABASE_PUBLISHABLE_KEY`). Pode ser colada no `.env` do projeto novo. RLS continua protegendo: o site de rastreio só consegue ler o que as policies + edge functions liberam pra `anon`.

As páginas de rastreio/pagamento chamam edge functions deste projeto via URL absoluta:

```ts
fetch("https://wzxfbejykayahnfdkdbl.functions.supabase.co/rastreio-info", { ... })
```

(hoje elas usam `supabase.functions.invoke`, que resolve pra essa mesma URL — só trocamos para a URL fixa deste projeto.)

## Passo a passo

### 1. Preparar este projeto (Magnus, conta atual)
- Confirmar que as edge functions usadas pelos sites públicos têm CORS aberto (`Access-Control-Allow-Origin: *`) — quase todas já têm.
- Confirmar que as policies RLS de `envios`, `pix_payments`, `empresas`, `lojas` permitem o SELECT mínimo que o rastreio precisa para `anon` (hoje já permitem, via edge functions com service role).
- Nenhuma mudança de schema necessária.

### 2. Criar o projeto novo na outra conta Lovable
- Criar projeto em branco (sem Lovable Cloud).
- Copiar para ele:
  - `src/pages/Rastreio.tsx`, `Pagamento.tsx`, `PagamentoFalha.tsx`, `Taxacao.tsx`, `FalhaEntrega.tsx`, `TermosPrivacidade.tsx`
  - `src/lib/domain-config.ts` (reduzido — só hosts de logística)
  - Componentes shadcn usados por essas páginas
  - Assets `public/logo-*.svg` e imagens
  - `src/App.tsx` reduzido (só `LogisticsRoutes`)
  - `index.html`, `tailwind.config.ts`, `index.css`
- Adicionar `@supabase/supabase-js` e criar `src/integrations/data/client.ts` apontando para a URL+anon deste projeto.
- Trocar `supabase.functions.invoke("xxx")` por `fetch("https://wzxfbejykayahnfdkdbl.functions.supabase.co/xxx", ...)` nas páginas.
- Ferramenta que facilita isso: **cross-project copy** — posso usar `@mention` para o projeto novo e copiar arquivos automaticamente assim que ele existir e estiver no mesmo workspace; se for em outra conta sem workspace compartilhado, você baixa este projeto via GitHub e cola no novo.

### 3. Apontar domínios
- Mover os DNS de `atlas-cargo.org`, `vetortransportesltda.com`, `jltransportelogistica.com` para o publish do projeto novo.
- Remover esses domínios deste projeto (Project Settings → Domains).
- Manter `magnusfrete.net` neste projeto.

### 4. Limpar este projeto (opcional, depois que o novo estiver no ar)
- Remover `LogisticsRoutes` e páginas públicas de rastreio do código.
- Manter as edge functions — elas continuam sendo o backend do site novo.

## Detalhes técnicos importantes

- **Chave anon é segura no cliente.** A chave de service role (não disponível em Lovable Cloud) nunca sai do servidor.
- **CORS:** todas as edge functions chamadas pelos sites públicos precisam aceitar a origem do novo domínio. Como já usam `*`, funciona.
- **Webhooks de pagamento PIX** (CyberPay) continuam chegando neste projeto, porque a function `check-pix-payment` está hospedada aqui. O site novo só consulta status.
- **Realtime / push:** não é usado pelo fluxo público de rastreio, então sem impacto.
- **Banco único = backup único.** O backup pra Google Drive deste projeto continua cobrindo tudo.

## Alternativa (não recomendada): banco separado

Criar um novo Lovable Cloud na conta nova e replicar dados via ETL. Rejeitada porque (a) duplica custo, (b) exige sincronização constante de envios/pagamentos entre dois bancos, (c) quebra a fonte única de verdade do painel Magnus.

## Confirmações que preciso de você

1. A conta nova é da mesma organização/workspace Lovable, ou é totalmente separada? (Define se posso usar cross-project copy ou se você precisa migrar via GitHub.)
2. Posso assumir que **só** os domínios de logística (Atlas, Vetor, JL) vão para o projeto novo, e o Magnus continua aqui?
3. Os pagamentos PIX (CyberPay) devem continuar processados por este projeto, certo? (Recomendado — senão precisamos duplicar a integração na conta nova.)
