

## Plan: Filtro de datas na página de Pagamentos PIX

### Alteração

**`src/pages/admin/AdminPagamentos.tsx`** — Adicionar filtro de período com atalhos rápidos e date pickers.

1. **Adicionar estados de data**: `dateFrom` e `dateTo` (tipo `Date | undefined`), inicializando com "Hoje" como padrão
2. **Atalhos rápidos**: Botões "Hoje", "7 dias", "30 dias", "Todos" que setam `dateFrom`/`dateTo` automaticamente
3. **Date pickers**: Dois `Popover` + `Calendar` para selecionar datas customizadas (De / Até)
4. **Filtro client-side**: Filtrar `payments` por `created_at` dentro do range antes de calcular as métricas (receita, moedas, pagos, pendentes) e a tabela
5. **Métricas reativas**: Os 4 cards de resumo recalculam com base nos pagamentos filtrados por data + status

### Visual
- Linha de filtro entre o título e os cards, com botões de atalho + dois seletores de data lado a lado
- Botão ativo destacado com variante `default`, demais com `outline`

### Fluxo de dados
```text
payments (todos) → filteredByDate (dateFrom/dateTo) → cards usam filteredByDate
                                                     → filteredByDate + tab → tabela
```

### Arquivo alterado
- `src/pages/admin/AdminPagamentos.tsx` (apenas)

