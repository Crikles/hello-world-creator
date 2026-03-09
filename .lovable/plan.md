

# Paginação na página de Envios

## O que será feito
Adicionar paginação de 20 itens por página na listagem de envios, com controles de navegação (anterior/próximo + números de página) na parte inferior.

## Alterações

### `src/pages/Envios.tsx`
1. Adicionar estado `currentPage` (resetar para 1 quando filtros mudarem)
2. Após `filteredEnvios`, calcular `paginatedEnvios` com slice de 20 por página
3. Renderizar `paginatedEnvios` ao invés de `filteredEnvios` no map de rows
4. Adicionar componente de paginação abaixo da listagem usando os componentes `Pagination` já existentes
5. O `handleSelectAll` deve selecionar apenas os itens da página atual

### Detalhes técnicos
- `ITEMS_PER_PAGE = 20`
- `totalPages = Math.ceil(filteredEnvios.length / ITEMS_PER_PAGE)`
- `paginatedEnvios = filteredEnvios.slice((currentPage - 1) * 20, currentPage * 20)`
- Reset `currentPage` para 1 quando `search`, `filterStatus` ou `dateRange` mudar
- Exibir info tipo "Mostrando 1-20 de 798 envios"
- Navegação: Anterior, até 5 números de página com ellipsis, Próximo

