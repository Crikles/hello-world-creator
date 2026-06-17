## Problema

No widget de rastreio (script embedável em Shopify/sites), todas as etapas posteriores ao "Postado" aparecem com a mesma data (no print, todas em `07 de jun.` e só "Postado" em `06 de jun.`).

Causa: o widget calcula a data de cada evento como `envio.created_at + delay_horas do template`. O `delay_horas` é um agendamento teórico em horas a partir da postagem — quando os valores são pequenos (ou foram configurados em horas e não em dias inteiros), todas as etapas caem no mesmo dia, mesmo que, na realidade, o cron tenha disparado uma etapa por dia.

A página interna `/rastreio` tem o mesmo defeito de outra forma: ela faz `updated_at - idx * 1 dia`, o que também não é a data real, só uma simulação.

A data correta de cada etapa já existe no banco: `postagem_email_log.created_at` por `envio_id + evento_id` registra o instante em que aquela etapa foi efetivamente disparada pelo `advance-shipments`.

## Mudanças

### 1. `supabase/functions/rastreio-info/index.ts`
- Depois de carregar `eventos` (filtrados por `ordem <= ultimo_evento_ordem`), buscar em `postagem_email_log` todos os registros do `envio_id` atual com `status in ('sent','queued','delivered')` agrupando por `evento_id` e pegando o `min(created_at)` (primeiro disparo daquela etapa).
- Anexar `enviado_em` (ISO string) em cada item de `eventos`. Se não houver log para uma etapa (ex.: etapa sem template de e-mail ou backlog antigo), deixar `enviado_em: null`.
- Para a etapa "Postado" (ordem 1, normalmente sem log), usar `envio.created_at` como fallback.

### 2. `public/widget/tracking.js` (`renderResult`)
- Substituir o cálculo `baseTs + delay_horas` por:
  - se `ev.enviado_em` veio do backend → usar esse timestamp;
  - senão → fallback atual (`created_at + delay_horas`), mantendo compatibilidade.
- Ordenação continua por timestamp desc.
- `ultimaAtualizacao` passa a usar o maior `enviado_em` disponível.

### 3. `src/pages/Rastreio.tsx` (3 blocos de timeline nas linhas 701, 966, 1208)
- Trocar o cálculo `new Date(envio.updated_at) - idx*1dia` por:
  - `ev.enviado_em ? new Date(ev.enviado_em) : <fallback antigo>`.
- Formatar com a mesma máscara já usada (`dd/MM/yyyy`).

### 4. Tipos
- `src/pages/Rastreio.tsx`: adicionar `enviado_em?: string | null` no tipo de evento (linha ~130).

## Fora do escopo
- Não mexer no agendamento (`advance-shipments`) nem em `delay_horas` do template.
- Não recalcular eventos antigos para os quais não existe registro em `postagem_email_log` — eles caem no fallback atual.

## Validação
1. Abrir o widget num envio recente com várias etapas avançadas em dias diferentes e conferir que cada linha mostra o dia real do disparo.
2. Conferir a página interna `/rastreio?codigo=...`.
3. Conferir um envio antigo sem log: deve continuar renderizando sem erro usando o fallback.