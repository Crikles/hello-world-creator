

## Plano: Forçar/Avançar Todos respeitando o filtro ativo

### Problema

Atualmente, "Avançar Todos" e "Forçar Todos" operam sobre a lista completa (`envios`), ignorando o filtro de status ativo. Se o usuário filtra por "Centro Local", o botão deveria agir apenas sobre esses envios filtrados.

### Mudança em `src/pages/Envios.tsx`

Uma alteração simples em duas funções:

1. **`handleAvancarTodos`** (linha 464): trocar `envios` por `filteredEnvios` na base de filtragem
2. **`handleForcarTodos`** (linha 505): trocar o fallback `envios` por `filteredEnvios` quando nenhum item está selecionado manualmente

Lógica resultante:
- Se há itens selecionados manualmente (checkboxes), processa apenas esses (comportamento atual mantido)
- Se nenhum item está selecionado, processa os envios do **filtro ativo** em vez de todos

Isso elimina a necessidade de aumentar o número de linhas por página ou selecionar manualmente centenas de itens.

