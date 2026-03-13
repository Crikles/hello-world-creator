

# Fix: "Forçar Todos" ignora seleção e processa todos os envios

## Problema
Na função `handleForcarTodos` (linha 496), o filtro usa `envios` (todos os envios carregados) sem verificar se há itens selecionados em `selectedIds`. Resultado: mesmo com 40 pedidos selecionados, processa 1000+.

## Correção em `src/pages/Envios.tsx`

Alterar a linha 496 para priorizar `selectedIds` quando houver seleção:

```typescript
const handleForcarTodos = async () => {
  const base = selectedIds.size > 0
    ? envios.filter((e) => selectedIds.has(e.id))
    : envios;
  const targets = base.filter((e) => e.status !== "entregue" && (e.ultimo_evento_ordem ?? 0) > 0);
  // ... resto igual
};
```

Mesma lógica já é usada no delete em batch (`batchDeleteMutation` usa `selectedIds`). Isso garante consistência: se há seleção, opera apenas nos selecionados; se não há, opera em todos (comportamento atual).

## Arquivo alterado
- `src/pages/Envios.tsx` — apenas a função `handleForcarTodos`

