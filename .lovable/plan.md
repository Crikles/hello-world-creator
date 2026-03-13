

## Plano: Corrigir Forçar/Avançar Todos ignorando seleção manual

### Problema raiz

O `selectedIds` é um estado React (Set). Em cenários de re-renderização rápida (realtime, invalidateQueries), o handler pode capturar um `selectedIds` com `size === 0`, fazendo o fallback para `filteredEnvios` e processando todos os itens do filtro em vez dos selecionados.

### Correções em `src/pages/Envios.tsx`

1. **Adicionar ref sincronizada com selectedIds** para evitar stale closures:
   - `const selectedIdsRef = useRef(selectedIds)` + `useEffect` para manter sincronizado
   - Usar `selectedIdsRef.current` dentro dos handlers `handleAvancarTodos` e `handleForcarTodos`

2. **Adicionar diálogo de confirmação** antes de executar as ações em massa:
   - Mostrar "Você está prestes a forçar X envio(s). Continuar?"
   - Se itens selecionados: "X envio(s) selecionado(s)"
   - Se nenhum selecionado: "X envio(s) do filtro ativo"
   - Isso previne execução acidental e permite ao usuário verificar a contagem

3. **Mostrar contagem nos botões** para feedback visual imediato:
   - "Forçar Todos (10)" quando há seleção
   - "Forçar Todos (142)" quando usa filtro

