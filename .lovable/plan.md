## Diagnóstico

O usuário "negociosmilionarios1901@gmail.com" (loja **Prime**) tem **1.724 envios travados** sem avançar — incluindo o pedido do Elvis (parado desde 24/04 em "Coletado", deveria ter avançado em 25/04). Globalmente, há **~14 mil envios travados** em várias lojas (Variedades: 9.845, Prime: 1.656, Shopee: 1.109, etc.).

### Causa raiz (bug crítico no cron `advance-shipments`)

O cron roda a cada 2 minutos e processa no máximo 500 envios por run, com `MAX_PER_LOJA = 300`. A query SQL na linha 472 seleciona envios elegíveis com `proximo_avanco_em < now()`, mas **NÃO exclui envios cujo próximo evento é "Entregue"**.

Quando o cron pega um envio onde `nextEvent.status_label = "Entregue"` (linha 808–815 de `advance-shipments/index.ts`):

```ts
if (isFinalDelivered) {
  console.log(`Cron skip: 'Entregue' requires manual confirmation...`);
  return false;
}
```

Faz `return false` **sem atualizar `proximo_avanco_em`**. Resultado: na próxima execução do cron (2 min depois), os MESMOS envios entram na fila novamente — loop infinito.

Os logs do cron confirmam: 100% dos logs visíveis são "Cron skip: 'Entregue' requires manual confirmation". A função fica saturada processando ~6.408 envios "Saiu para Entrega" que nunca podem avançar (porque o próximo é "Entregue", manual). Isso consome os 300 slots por loja e os 500 globais, bloqueando envios legítimos como o do Elvis.

Distribuição dos vencidos:
- 5.299 em "Saiu para Entrega" (ordem 5)
- 1.109 em "Saiu para Entrega" (ordem 7)
- 3.434 em "Postado" (ordem 1)
- 3.254 em "Em Trânsito" (ordem 3)
- 542 em "Centro Local" (ordem 4)
- 345 em "Coletado" (ordem 2) ← inclui o pedido do Elvis

## Plano de correção

### 1. Cron: marcar envios "prontos para entregar" como aguardando confirmação manual

Em `supabase/functions/advance-shipments/index.ts`, no bloco `isFinalDelivered` (linhas 808–815), antes do `return false`:

- Atualizar o envio: `proximo_avanco_em = NULL` e `status = 'saiu_para_entrega'`. Isso o tira da fila do cron permanentemente até a confirmação manual.
- Remover o `console.log` ruidoso (ou trocar por log único após batch).

### 2. Filtro SQL extra: nunca puxar envios "saiu_para_entrega"

Adicionar filtro `.neq("status", "saiu_para_entrega")` na query de elegíveis (linha 472–482). O status `saiu_para_entrega` por definição já indica "próximo é entregue", então não deve mais entrar no cron automático.

### 3. Backfill: limpar `proximo_avanco_em` dos ~6.408 envios "Saiu para Entrega" travados

Migration que atualiza:
```sql
UPDATE envios
SET proximo_avanco_em = NULL
WHERE deleted_at IS NULL
  AND status = 'saiu_para_entrega'
  AND proximo_avanco_em IS NOT NULL;
```

Isso libera imediatamente o cron para processar os envios reais.

### 4. Avanço imediato dos envios travados legítimos

Após o backfill, invocar manualmente o cron várias vezes para drenar a fila acumulada (1.724 da Prime + ~6.000 das outras lojas em estados Postado/Coletado/Em Trânsito/Centro Local). Como cada execução processa até 500, serão necessárias ~15 execuções consecutivas (~30 min de trabalho), ou alternativamente uma migration que atualiza diretamente `proximo_avanco_em` para `now()` e deixa o cron recuperar nas próximas horas.

Recomendo executar o cron em loop algumas vezes via fetch direto da edge function — mais seguro do que pular eventos via SQL (preserva débito/email/SMS).

### 5. (Opcional) Aumentar throughput do cron

Considerações para evitar o problema escalar de novo:
- Reduzir `BATCH_DELAY_MS` de 200 para 50 (processa 4x mais por run).
- Aumentar `MAX_PER_RUN` de 500 para 1000.
- Adicionar `ORDER BY` na query de configs (`configs.sort` por loja com mais vencidos? ou randomizar) para que uma loja gigante não monopolize.

### Arquivos afetados

- `supabase/functions/advance-shipments/index.ts` — fix do skip "Entregue" + filtro SQL + (opcional) ajustes de throughput
- Nova migration: `clear_proximo_avanco_for_saiu_entrega` (backfill)
- Execução pontual do cron várias vezes para drenar fila

### Validação pós-deploy

- Rodar query do Elvis: deve avançar para ordem 3 ("Em Trânsito") em até 2 min.
- Total de envios vencidos deve cair drasticamente nas primeiras horas.
- Logs do cron devem mostrar "Cron complete: processed N shipments" ao invés de só "Cron skip: Entregue".

### Riscos

- O filtro `status = 'saiu_para_entrega'` significa que envios com configurações de template onde "Saiu para Entrega" NÃO é o penúltimo evento ainda funcionarão (porque `status` só é setado para `saiu_para_entrega` quando `eventIndex === totalEvents - 2`).
- Backfill é seguro: setar `proximo_avanco_em = NULL` apenas remove da fila do cron, não altera estado nem cobrança.
