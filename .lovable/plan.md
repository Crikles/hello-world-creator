## Objetivo
Adicionar o canal **Global** ao card "Canais de Notificação" no Dashboard, refletindo o status ativo/inativo do fluxo global da loja.

## Alterações

### 1. `src/pages/Dashboard.tsx`
- Adicionar query `useQuery` para buscar `ativo` da tabela `global_flow_config` filtrando por `loja_id`.
- Incluir o ícone `Globe` do Lucide na importação.
- Inserir o item `{ icon: Globe, label: "Global", ... }` no array de canais de notificação (logo após "Email" ou no final, conforme preferir).
- O status ativo/inativo será baseado no campo `ativo` retornado da query.

### 2. Ícone
- Usar o ícone `Globe` da biblioteca `lucide-react` para manter consistência visual com os demais canais.

Nenhuma alteração de backend ou banco de dados é necessária — a tabela `global_flow_config` já existe.