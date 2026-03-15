

## Plano: Placar de Produtos Mais Vendidos por Usuário

### O que será feito
Adicionar um painel visual (scoreboard) que aparece automaticamente quando um usuário específico é filtrado, mostrando os **top 5 produtos mais vendidos** com quantidade e valor, em formato de cards destacados acima da tabela de leads.

### Alterações em `src/pages/admin/AdminLeads.tsx`

1. **Scoreboard automático**: Quando `selectedUsers.length === 1`, renderizar uma seção com cards mostrando os top 5 produtos do ranking já calculado (`productRanking`).

2. **Layout**: Cards horizontais com:
   - Posição (medalha/número)
   - Nome do produto
   - Quantidade vendida
   - Valor total

3. **Visibilidade**: O scoreboard aparece entre os filtros e a tabela, apenas quando há um usuário filtrado. Funciona independente do toggle "Mais Vendidos" (que continua mostrando a tabela completa).

### Detalhes técnicos
- Sem mudanças no banco
- Reutiliza o `productRanking` já calculado (agregação client-side sobre `filtered`)
- Apenas UI: 5 cards com `slice(0, 5)` do ranking existente

