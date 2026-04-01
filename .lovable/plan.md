

## Plan: Corrigir detecção de PIX pendente no webhook Corvex

### Problema identificado

A condição de detecção de evento pendente na linha 163 do `webhook-corvex` está errada:

```typescript
// ATUAL (bugado)
const isPendingEvent = (event === "corvex.order.created" && status === "pending") || event === "corvex.order.pending";
```

Analisando os logs reais do banco, a Corvex envia **`corvex.order.paid`** com `status: "pending"` quando um PIX é gerado mas não pago. A condição atual **nunca** captura esse caso, pois só verifica `corvex.order.created` ou `corvex.order.pending`.

Evidência nos logs:
```
raw_event: corvex.order.paid | raw_status: pending  ← NÃO CAPTURADO
raw_event: corvex.order.created | raw_status: pending ← capturado
```

### Correção

Alterar a condição para capturar **qualquer evento com status `pending`**:

```typescript
// CORRIGIDO
const isPendingEvent = status === "pending";
```

Isso é seguro porque o fluxo de recovery já verifica se `recovery_config.ativo` está true e faz deduplicação por email/tipo nas últimas 24h.

### Arquivo alterado
- `supabase/functions/webhook-corvex/index.ts` — linha 163

### Publicação
Não precisa publicar o frontend. Edge functions são deployadas automaticamente.

