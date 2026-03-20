

## Plano: Corrigir Avanço Automático Travado

### Diagnóstico
O cron `advance-shipments` busca até 100 envios por loja com `proximo_avanco_em <= now()`. Porém, **não exclui envios com status "Falha Entrega" ou "Taxação"** da query SQL. Como há 876 envios pausados em "Falha Entrega", eles consomem o limite de 100 por loja, e os 1.134 envios legítimos (Postado, Coletado, Em Trânsito) nunca são processados.

O cron gasta todo o tempo logando "Skip envio: waiting for manual approval" e retorna "processed 0 shipments".

### Correção (1 arquivo)

**`supabase/functions/advance-shipments/index.ts`** — Adicionar filtro SQL para excluir envios pausados:

Na query de envios elegíveis (linha ~423), adicionar filtro `not.in` no `status_label` para excluir `Falha Entrega`, `Taxação` e `Taxacao`:

```sql
-- Antes: busca tudo e pula no código
.or(`proximo_avanco_em.is.null,proximo_avanco_em.lte.${now}`)

-- Depois: exclui pausados direto na query
.not("status_label", "in", '("Falha Entrega","Taxação","Taxacao")')
.or(`proximo_avanco_em.is.null,proximo_avanco_em.lte.${now}`)
```

Isso garante que os 100 slots por loja sejam usados apenas por envios que realmente podem avançar.

### Impacto
- **2.010 envios travados** → 1.134 voltarão a avançar automaticamente no próximo ciclo do cron (5 min)
- Os 876 em "Falha Entrega" continuam corretamente pausados aguardando aprovação manual
- Sem mudança de comportamento, apenas eficiência na query

