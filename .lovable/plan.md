

## Plano: Congelar template em envios ao trocar template ativo

### Problema
Quando o usuário troca o template ativo na página de Postagens, envios já em andamento que não têm `postagem_template_id` definido (são `NULL`) passam a usar o novo template, alterando o fluxo no meio do caminho.

### Solução
Ao trocar o template ativo, antes de salvar o novo `template_ativo_id`, fazer um UPDATE em todos os envios **em andamento** (`status != 'entregue'` e `postagem_template_id IS NULL`) para gravar o template antigo neles. Assim, esses envios continuam seguindo o fluxo original.

### Alterações

**1. `src/pages/Postagens.tsx`**
- Na função que salva/troca o `template_ativo_id` (ao selecionar um novo template), adicionar lógica:
  - Se já existia um `template_ativo_id` anterior, fazer um UPDATE nos envios da loja onde `postagem_template_id IS NULL`, `status != 'entregue'`, e `deleted_at IS NULL` → setar `postagem_template_id` = template antigo
  - Depois, salvar o novo `template_ativo_id` normalmente

**2. `supabase/functions/advance-shipments/index.ts`** e **`src/lib/email-trigger.ts`**
- Sem alteração necessária — já usam `shipment.postagem_template_id || config.template_ativo_id`, e com a correção acima, envios em andamento terão sempre o campo preenchido

### Impacto
- Envios novos: sempre recebem o template ativo no momento da criação (já funciona)
- Envios em andamento: ao trocar template, recebem o template antigo gravado, mantendo o fluxo original
- Envios finalizados (entregues): não são afetados

