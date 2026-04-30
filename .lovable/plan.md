## Diagnóstico (loja RIFA — feernandosousa)

Verifiquei os dados no banco e identifiquei **3 bugs distintos** no módulo de Confirmação de Pagamento:

### Bug 1 — "Pendentes" mostra 1.194 grupos (≈120 páginas) que na verdade estão OK

A RPC `get_confirmacao_grouped` (filtro `pendentes`) inclui qualquer grupo onde `email_status = 'failed'` **OU** `sms_status = 'failed'`. Mas na UI o status unificado prioriza o e-mail: se o e-mail foi enviado com sucesso, o grupo aparece com badge verde "Enviado".

Confirmado nos dados da loja:
- 1.191 grupos têm **e-mail enviado com sucesso** + SMS falhou (provavelmente sem saldo só pra SMS).
- Esses 1.191 grupos não deveriam ser contados como Pendentes nem aparecer na lista filtrada por Pendentes.
- Por isso o usuário vê páginas e mais páginas com badge "Enviado" dentro do filtro Pendentes.

A RPC `get_confirmacao_placar` já usa a lógica correta (status unificado). A divergência entre as duas RPCs é o que causa o número certo no card mas a paginação errada na lista.

### Bug 2 — Pedidos de hoje sumindo do histórico

18 pedidos `approved` da Vega criados hoje (30/04) **não geraram nenhum log** em `confirmacao_pagamento_log`. Último log da loja é 29/04 22:53.

Causa: em `webhook-vega/index.ts` (linhas 414–417), quando o RPC `try_create_envio_dedupe` retorna `was_duplicate=true`, a função faz **early return** sem invocar `send-payment-confirmation`. Isso acontece quando o webhook da Vega manda primeiro um evento que cria o envio (ex.: pending) e depois o `approved` cai no caminho duplicado. Como nenhum log é criado, o pedido nunca aparece no histórico.

### Bug 3 — Webhooks de outros providers podem ter o mesmo padrão

Vou auditar `webhook-zedy`, `webhook-luna`, `webhook-adoorei`, `webhook-corvex`, `webhook-nuvorafy` e `shopify-webhook` para garantir que todos disparem `send-payment-confirmation` mesmo no caso de envio duplicado (desde que o pedido esteja `approved`).

---

## Plano de correção

### 1. Corrigir filtro "Pendentes" e "Enviados" na RPC `get_confirmacao_grouped`

Migration alterando a CTE `filtered` para usar a mesma lógica unificada do placar:

```text
status_unificado =
  'sent'   se email_st='sent' OU (email_st IS NULL E sms_st='sent')
  'failed' se email_st='failed' OU (email_st IS NULL E sms_st='failed')
  'none'   caso contrário

p_status='pendentes' → status_unificado = 'failed'
p_status='enviados'  → status_unificado = 'sent'
```

Isso fará com que:
- Card "Pendentes" e a lista filtrada por Pendentes mostrem o **mesmo número**.
- Casos em que e-mail foi enviado e SMS falhou apareçam como Enviados (não Pendentes).
- `total_count` (paginação) reflita o número real.

### 2. Garantir disparo de `send-payment-confirmation` em pedidos duplicados (Vega)

Em `supabase/functions/webhook-vega/index.ts` no bloco `wasDuplicate`:
- Antes do early return, invocar `send-payment-confirmation` com `pedido_id`/`loja_id` se o pedido estiver `approved` e ainda não tiver log de confirmação.
- A própria função `send-payment-confirmation` já tem proteção idempotente (não envia duplicado para o mesmo pedido), então é seguro.

### 3. Auditar e padronizar os outros webhooks de checkout

Para cada um (`zedy`, `luna`, `adoorei`, `corvex`, `nuvorafy`, `shopify`), garantir que o disparo de `send-payment-confirmation` aconteça sempre que o status for `approved`, **independente** do envio ter sido criado agora ou já existir. O critério deve ser "pedido aprovado", não "envio criado pela primeira vez".

### 4. Backfill dos pedidos que ficaram sem confirmação

Migration (ou invocação pontual) que percorre os pedidos `approved` da loja `d8257e10-6a55-498e-aba8-e87ee6651985` (e outras que possam ter o mesmo problema) sem registro em `confirmacao_pagamento_log` nas últimas 48h e dispara `send-payment-confirmation` para cada um. A função em si já é idempotente.

### Arquivos afetados
- `supabase/migrations/<nova>_fix_confirmacao_grouped_unified_status.sql`
- `supabase/functions/webhook-vega/index.ts`
- `supabase/functions/webhook-zedy/index.ts`
- `supabase/functions/webhook-luna/index.ts`
- `supabase/functions/webhook-adoorei/index.ts`
- `supabase/functions/webhook-corvex/index.ts`
- `supabase/functions/webhook-nuvorafy/index.ts`
- `supabase/functions/shopify-webhook/index.ts`
- `supabase/migrations/<nova>_backfill_confirmacao_pagamento.sql` (ou execução pontual)

### Riscos / observações
- A loja RIFA tem 1.191 casos antigos onde só o SMS falhou — após a correção da RPC, eles deixam de aparecer como Pendentes. Se o usuário quiser **reenviar só o SMS desses casos**, podemos manter um botão dedicado, mas isso seria uma feature separada.
- Após o deploy do webhook-vega corrigido, novos pedidos passarão a gerar confirmação corretamente; o backfill resolve o que já entrou hoje sem confirmação.
