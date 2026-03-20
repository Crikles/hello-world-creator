

## Plano: Adicionar Barra de Progresso ao "Forçar Todos" e "Avançar Todos"

### Problema
Os botões "Forçar Todos" e "Avançar Todos" agendam envios no servidor (atualizam `proximo_avanco_em = now()`), mas **não usam o `BatchProgressContext`** para mostrar a barra de progresso. Após confirmar no AlertDialog, o sistema só mostra um toast — sem feedback visual de carregamento.

Isso acontece para todos os usuários (admin impersonando ou não).

### Correção

**Arquivo: `src/pages/Envios.tsx`** — Função `handleBatchConfirmed` (linhas 482-517)

Integrar com `startBatch` / `updateProgress` / `finishBatch` do `BatchProgressContext`:

1. Chamar `startBatch(targets.length)` antes de iniciar os chunks
2. Chamar `updateProgress(updated)` após cada chunk de 50
3. Chamar `finishBatch()` ao final
4. Verificar `checkCancelled()` entre chunks para permitir cancelamento
5. Em caso de erro, chamar `finishBatch()` para limpar a barra

Isso fará a barra de progresso aparecer no header (já implementada no `AppLayout`) e o botão de cancelar substituir os botões de ação (já implementado nas linhas 706-715).

