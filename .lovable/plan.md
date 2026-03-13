

# Progresso de batch persistente entre navegações

## Problema
O estado `batchProgress` é local ao componente `Envios.tsx`. Quando o usuário navega para outra aba, o componente desmonta, o estado some e o loop async perde referência ao setter.

## Solução
Criar um **BatchProgressContext** que vive no nível do `LojaLayoutWrapper` (acima do `Outlet`), mantendo o estado e a lógica de processamento persistentes durante a navegação entre abas da loja.

### Arquivos

**1. Criar `src/contexts/BatchProgressContext.tsx`**
- Context com estado: `{ processing, current, total, startedAt }` + `cancelRef`
- Funções expostas: `startBatch(total)`, `updateProgress(current)`, `finishBatch()`, `cancelBatch()`
- Cálculo de tempo estimado: `((elapsed / current) * (total - current))` formatado em minutos/segundos
- O context NÃO executa a lógica de envio — apenas gerencia o estado de progresso

**2. Modificar `src/pages/Envios.tsx`**
- Importar `useBatchProgress()` do context
- Substituir o `useState<batchProgress>` local pelo context
- As funções `handleAvancarTodos` e `handleForcarTodos` usam `startBatch()`, `updateProgress()`, `finishBatch()` do context
- O `batchCancelRef` vem do context (`cancelRef`)

**3. Modificar `src/components/layout/AppLayout.tsx`**
- Importar `useBatchProgress()`
- Renderizar uma barra de progresso fixa no topo (abaixo do header) quando `processing === true`
- Mostrar: `Processando {current}/{total} — Tempo estimado: ~Xmin Ys` + botão Cancelar
- Usar `Progress` component existente com porcentagem visual

**4. Modificar `src/App.tsx`**
- Envolver `LojaLayoutWrapper` com `<BatchProgressProvider>`

### UI do progresso global (no AppLayout)
```
┌──────────────────────────────────────────────────────┐
│ ⚡ Processando 3/40 — Estimativa: ~37 min  [Cancelar]│
│ ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  7.5%        │
└──────────────────────────────────────────────────────┘
```

Barra amarela/amber com animação sutil, posicionada logo abaixo do header sticky, visível em qualquer aba da loja.

