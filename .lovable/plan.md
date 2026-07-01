## Contexto

Hoje `envios.valor` é sempre exibido como **R$**, mesmo em vendas internacionais. O pedido `pedidos.raw_payload.currency` já contém a moeda real (nos 2 pedidos recentes da Velora é **GBP £**, não Euro). Precisamos guardar essa moeda no envio e formatar o símbolo dinamicamente.

## O que será feito

### 1. Banco
- Adicionar coluna `moeda` (text, default `'BRL'`) em `envios`.
- Backfill dos envios internacionais existentes lendo `pedidos.raw_payload.currency` do pedido vinculado; se ausente, cai para `USD` (fluxo global US) ou `EUR` (fluxo global ES).

### 2. Webhooks (gravar moeda ao criar envio)
- `shopify-webhook`: usar `payload.presentment_currency || payload.currency`.
- `webhook-cloudfy` e demais webhooks internacionais: ler campo equivalente do payload.
- Nacionais continuam `BRL` por padrão.

### 3. Frontend — helper `formatMoney(valor, moeda)`
Novo utilitário em `src/lib/format-money.ts`:
- BRL → `R$ 1.234,56` (pt-BR)
- USD → `$1,234.56`
- EUR → `€1.234,56`
- GBP → `£1,234.56`

### 4. Aba Envios (`src/pages/Envios.tsx`)
- Substituir os locais onde aparece `R$ {valor}` (cards mobile, tabela desktop, export CSV) por `formatMoney(envio.valor, envio.moeda)`.

### 5. Dashboard (`src/pages/Dashboard.tsx`)
- Cards de faturamento e tooltip do gráfico passam a somar/exibir por moeda:
  - Se a loja tem só uma moeda → mostra o total naquela moeda.
  - Se tem múltiplas → mostra breakdown (ex.: `R$ 1.500,00 · £ 59,80`).
- Ajustar RPC `get_loja_faturamento` e `get_loja_chart_data` para agrupar por moeda (ou fazer a agregação no client).

## Fora de escopo
- E-mails de fluxo já usam `formatGlobalCurrency` próprio — não mexer.
- Conversão cambial (não converteremos GBP→BRL, só exibiremos cada moeda como veio).

## Observação
Os 2 pedidos recentes da Velora vieram em **GBP (£)** e não em Euro — a loja vende no Reino Unido. Após esse ajuste, aparecerão corretamente como `£ 29,90` na aba Envios.
