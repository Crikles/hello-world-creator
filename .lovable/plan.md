

# Confirmação de exclusão em massa com AlertDialog

## Problema
1. O botão "Excluir" usa `confirm()` nativo do navegador — fora do padrão visual do sistema
2. Delay perceptível ao apagar muitos envios (a query `.in("id", ids)` com muitos IDs é lenta)

## Solução

### 1. Substituir `confirm()` por AlertDialog (Radix)
Adicionar um estado `deleteConfirmOpen` e usar `AlertDialog` com mensagem customizada:
- Título: "Excluir envios selecionados"
- Descrição: "Realmente deseja apagar todos os seus Clientes? Pedidos irão parar de ser enviados."
- Botões: "Cancelar" e "Confirmar exclusão"

### 2. Otimizar a exclusão em lote
Quando há muitos IDs (ex: >50), dividir em chunks de 50 para evitar queries muito pesadas, ou usar uma abordagem mais direta. Na prática o delay vem do `.in("id", ids)` com centenas de IDs — chunking ajuda.

### Mudanças em `src/pages/Envios.tsx`

| O quê | Como |
|---|---|
| Estado `deleteConfirmOpen` | `useState(false)` |
| Botão "Excluir" `onClick` | Abre o AlertDialog em vez de `confirm()` |
| AlertDialog | Mensagem "Realmente deseja apagar todos os seus Clientes? Pedidos irão parar de ser enviados" com botões Cancelar/Confirmar |
| `batchDeleteMutation` | Chunking de 50 IDs por request para reduzir delay |

