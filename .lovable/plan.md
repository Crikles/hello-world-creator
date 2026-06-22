## Diagnóstico

Dois bugs com a mesma causa: o sistema **não diferencia envio internacional do nacional** no momento de avançar etapa / enviar e-mail.

1. **Contador `0/16` em /envios** — meu fix anterior em `getTotalEventos` está correto, mas `paginatedEnvios` vem da RPC `get_envios_paginated` que faz `to_jsonb(base.*)`. Vou reconfirmar que `is_international` chega no front (já confirmei no banco que os envios Jorge/Jurema têm `is_international=true`). Provavelmente é hot-reload — mesmo assim vou robustecer.

2. **E-mails errados (nacional em vez de global)** — `src/lib/email-trigger.ts` (UI manual) e `supabase/functions/advance-shipments/index.ts` (cron) sempre:
   - Carregam `postagem_eventos` (16 passos nacional)
   - Invocam `send-email` (template nacional)
   - Ignoram que existe `send-global-flow` e `global_flow_eventos` (10 passos EN/ES já implementados)

Ambos precisam **bifurcar por `is_international`** e, quando true, usar `global_flow_eventos` para delays/total e invocar `send-global-flow` com `step`.

## Mudanças

### 1) `src/lib/email-trigger.ts`

No início, após carregar o `shipment`:

```ts
if (shipment.is_international) {
  return await triggerGlobalFlow(shipment, lojaId, forceAdvance);
}
```

Criar `triggerGlobalFlow(shipment, lojaId, forceAdvance)`:
- Buscar `global_flow_config` (loja). Se `!ativo` → return null.
- Buscar `global_flow_eventos` (loja) ordenados por `step_order`.
- `currentOrdem = shipment.ultimo_evento_ordem ?? 0`.
- Respeitar `proximo_avanco_em` (igual lógica atual) se `!forceAdvance`.
- Próximo `step = currentOrdem + 1`. Se `>10` → null.
- Se step === 10 (Entregue) e `!forceAdvance` → return null (mesma regra do nacional).
- Update `envios` com lock otimista: `ultimo_evento_ordem = step`, `status` (em_transito; saiu_para_entrega quando step=9; entregue quando step=10), `proximo_avanco_em` = now + delay_horas do próximo step (step+1).
- Invocar `supabase.functions.invoke("send-global-flow", { body: { envio_id, step } })`.
- Não consultar `postagem_eventos`, não invocar `send-email`.

### 2) `supabase/functions/advance-shipments/index.ts`

Na função `advanceShipment(...)`, logo após `if (sErr || !shipment) return false;`:

```ts
if (shipment.is_international) {
  return await advanceGlobalFlow(supabase, shipment, lojaId);
}
```

Criar `advanceGlobalFlow(supabase, shipment, lojaId)`:
- Buscar `global_flow_config` da loja, sair se `!ativo`.
- Cache `globalEventsCache[lojaId]` para `global_flow_eventos` ordenados.
- `currentOrdem`, calcular `nextStep = currentOrdem + 1`. Se `>10` → false.
- Se step=10 (delivered) → não avançar via cron (manual only), retornar false.
- Respeitar `proximo_avanco_em`.
- Update otimista igual padrão atual.
- Invocar `send-global-flow` com `{ envio_id, step: nextStep }`.
- Reverter avanço se a invocação falhar (mesma lógica de rollback existente).

### 3) `src/pages/Envios.tsx` (reforço do contador)

Já corrigi `getTotalEventos`. Para garantir refresh:
- Confirmar que o seletor lê `(envio as any).is_international` (ok).
- Adicionar pequena verificação: se `globalFlowCount === 0` mas envio é global, fallback `10` (já está).

Não há mudança nova aqui — o problema do "0/16" deve sumir após o reload da preview. Vou também garantir que o `useQuery` de `globalFlowCount` está antes de qualquer render que use `getTotalEventos`.

### 4) Sem mudanças em backend SQL

`global_flow_eventos` já está populado (10 linhas) e `send-global-flow` já existe e funciona.

## Validação

1. Em /envios, envios internacionais existentes (Jorge/Jurema) mostram **n/10** (não 16).
2. Ao clicar "Avançar próximo" em um envio internacional, o cliente recebe e-mail em EN/ES (template global), não o template nacional.
3. Cron `advance-shipments` rodando: envios internacionais avançam pelos delays de `global_flow_eventos` (24/48/72/168h) e disparam `send-global-flow`.
4. Envios nacionais continuam usando `postagem_eventos` + `send-email` (sem regressão).

## Deploy

Após edição: `deploy_edge_functions` para `advance-shipments`.
