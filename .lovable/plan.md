## Problema confirmado

Investiguei a conta `rodrigosantosderesendejunior@gmail.com` (loja `yaveh`). Vários pedidos criados hoje entre 12:34 e 14:48 BRT pularam até **ordem 6 = "Falha Entrega"** em ~60 segundos (entre 14:52:21 e 14:53:14), com cobranças e e-mails sequenciais a milisegundos de distância.

**Causa raiz: condição de corrida no `advance-shipments`.**

Cada webhook de venda (Shopify, Vega, Luna, Adoorei, Corvex, Nuvorafy, api-external) dispara `advance-shipments` em paralelo. Os logs mostram dezenas de execuções concorrentes, várias com timeout 504 (150s). Quando há múltiplas execuções concorrentes:

1. Run A faz query da seção 2 (`proximo_avanco_em <= now`) e começa a avançar envio X.
2. Run B (disparado por outro webhook ~1s depois) faz a mesma query antes de A confirmar a atualização → também pega envio X.
3. Cada Run chama `advanceShipment(envioId)`, que faz `SELECT * FROM envios WHERE id = X` (sempre lê valor atual) e avança +1 ordem.
4. **Mas `advanceShipment` NÃO re-valida `proximo_avanco_em` após o fresh fetch.** Confia que a query do caller já filtrou.

Resultado: 5–6 runs paralelos avançam o MESMO envio em sequência (cada um lê ordem atualizada pelo anterior, mas nenhum bloqueia pelo `proximo_avanco_em` que já foi definido para 24h no futuro).

A função client-side `triggerNextEmail` (`src/lib/email-trigger.ts` linhas 38–42) já tem essa proteção. O cron no servidor não tem.

## Correção

### 1. Adicionar guarda de `proximo_avanco_em` dentro de `advanceShipment`

Em `supabase/functions/advance-shipments/index.ts`, logo após o fetch do shipment (após a linha 756), adicionar:

```ts
// Race-condition guard: skip if delay window hasn't elapsed
const proximoAvanco = shipment.proximo_avanco_em;
if (proximoAvanco && new Date(proximoAvanco) > new Date()) {
  console.log(`Skip envio ${envioId}: delay not elapsed (${proximoAvanco})`);
  return false;
}
```

Isto garante que mesmo se a query da seção 2 estiver desatualizada, o avanço é bloqueado pelo estado mais recente.

### 2. Lock atômico via UPDATE condicional

Para eliminar definitivamente a race, trocar o `UPDATE` da linha 873–881 por um update condicional que só atualiza se `ultimo_evento_ordem` ainda for o esperado:

```ts
const { data: updated, error: uErr } = await supabase
  .from("envios")
  .update({ ultimo_evento_ordem: nextEvent.ordem, status: newStatus, status_label: nextEvent.status_label, proximo_avanco_em: proximoAvancoEm })
  .eq("id", envioId)
  .eq("ultimo_evento_ordem", currentOrdem)  // optimistic lock
  .select("id");

if (uErr || !updated || updated.length === 0) {
  console.log(`Skip envio ${envioId}: já avançado por outro processo`);
  return false;
}
```

Se outro processo já avançou, o update afeta 0 linhas e abortamos sem cobrar nem mandar e-mail.

### 3. Mover o débito para DEPOIS do update bem-sucedido

Hoje o débito (linha 832–849) acontece ANTES do update. Em corrida, isso causa débitos duplicados. Reordenar para: validar saldo → tentar update condicional → se sucesso, debitar. Alternativa mais simples: manter ordem mas usar uma chave única (ex.: `creditos_transacoes` com índice único em `(user_id, descricao + envio_id + ordem)`) — mas o lock condicional já resolve a maior parte.

### 4. Remover dispatches redundantes de webhooks

Cada webhook de venda dispara `supabase.functions.invoke("advance-shipments", { body: {} })` SEM `loja_id`, ou seja, processa TODAS as lojas a cada venda recebida. Em horário de pico, isso multiplica a carga e amplifica a corrida.

Alterar todos os webhooks (`shopify-webhook`, `webhook-vega`, `webhook-luna`, `webhook-adoorei`, `webhook-corvex`, `webhook-nuvorafy`, `api-external`) para passar `body: { loja_id: lojaId }` ao invocar `advance-shipments`. Assim cada webhook só processa a sua loja, reduzindo concorrência geral.

### 5. Ferramenta de reversão para a loja afetada

Adicionar um endpoint admin (ou execução SQL única) para reverter os envios da loja `yaveh` que avançaram hoje incorretamente:

- Identificar envios da loja `428f4bb4-5b53-4d34-a9a1-a139e7cceaaf` criados hoje (>= 2026-04-29 00:00 BRT) com `updated_at - created_at < 2 horas` e `ultimo_evento_ordem >= 2`.
- Resetar para `ultimo_evento_ordem = 1`, `status_label = 'Postado'`, `status = 'em_transito'`, `proximo_avanco_em = created_at + 24h`.
- Registrar a quantidade revertida e estornar os créditos extras cobrados acima do esperado para a primeira etapa.

Apresentar lista exata para confirmação antes de aplicar (não fazer mudança automática sem revisão).

## Arquivos a alterar

- `supabase/functions/advance-shipments/index.ts` — guards 1, 2, 3.
- `supabase/functions/shopify-webhook/index.ts`
- `supabase/functions/webhook-vega/index.ts`
- `supabase/functions/webhook-luna/index.ts`
- `supabase/functions/webhook-adoorei/index.ts`
- `supabase/functions/webhook-corvex/index.ts`
- `supabase/functions/webhook-nuvorafy/index.ts`
- `supabase/functions/api-external/index.ts`
- Migração SQL de reversão dos envios afetados (após confirmação).

## O que NÃO vai mudar

- Templates da loja (estão corretos com delays de 24h).
- Configuração `auto_envio` da loja (continua funcionando como esperado).
- Lógica de `triggerNextEmail` no client (já tem o guard).
- Função de cleanup do Cloud (recente, intacta).