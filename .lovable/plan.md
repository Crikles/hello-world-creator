

## Plano: Adicionar ranking de "Produtos Mais Vendidos" no painel de Leads

### O que será feito
Adicionar um botão/toggle "Mais Vendidos" nos filtros existentes da página AdminLeads. Quando ativado, a tabela muda para exibir um ranking de produtos agregados (nome do produto, quantidade vendida, valor total), respeitando os filtros já ativos (usuário e data).

### Alterações em `src/pages/admin/AdminLeads.tsx`

1. **Novo state**: `showTopProducts` (boolean toggle)

2. **Lógica de agregação**: A partir do array `filtered` já existente, agrupar por nome de produto (usando `formatProduto`), contando quantidade e somando valor total. Ordenar por quantidade decrescente.

3. **Botão no header de filtros**: Um `Button` com ícone (TrendingUp ou BarChart3) ao lado dos filtros existentes, que alterna entre a visualização normal de leads e o ranking de produtos.

4. **Tabela alternativa**: Quando `showTopProducts === true`, renderizar uma tabela diferente com colunas:
   - Posição (#)
   - Produto
   - Quantidade vendida
   - Valor total (R$)

5. **Interação com filtros existentes**: O ranking respeita os filtros de usuário, data e busca já aplicados — a agregação roda sobre o array `filtered`.

6. **CSV**: O botão "Baixar CSV" exporta o ranking quando nessa visualização.

### Detalhes técnicos
- Sem mudanças no banco de dados
- A agregação é feita client-side sobre os dados já carregados
- Produtos JSON são normalizados via `formatProduto` antes de agrupar
- Paginação mantida no ranking (PAGE_SIZE = 25)

