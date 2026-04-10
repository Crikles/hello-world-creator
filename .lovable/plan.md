

## Plano: Otimizar carregamento da página de Envios

### Problema
A página Envios busca **TODOS** os registros da loja em loops de 1.000 (envios + pedidos), totalizando 6+ requests HTTP sequenciais para lojas com muitos registros. Tudo é filtrado e paginado no client-side.

### Solução: Paginação e contagens server-side

**A. Criar função de contagens (stats cards):**
```sql
CREATE FUNCTION get_envios_stats(p_loja_id uuid)
RETURNS TABLE(total bigint, pendentes bigint, em_transito bigint, entregues bigint)
```
Elimina a necessidade de buscar todos os registros só para contar.

**B. Criar função de listagem paginada com filtros:**
```sql
CREATE FUNCTION get_envios_paginated(
  p_loja_id uuid, p_search text, p_status text,
  p_page int, p_per_page int
)
RETURNS TABLE(... campos do envio + origem + metodo_pagamento ...)
```
Faz JOIN com `pedidos` server-side para trazer origem e método de pagamento junto, eliminando a query separada de pedidos. Aplica filtros no SQL.

**C. Atualizar `src/pages/Envios.tsx`:**
- Substituir o loop de envios por `supabase.rpc('get_envios_paginated', {...})`
- Substituir contagens manuais por `supabase.rpc('get_envios_stats', {...})`
- Remover a query separada de pedidos (dados vêm junto)
- Manter filtros de busca, status, data, método e origem — enviados como parâmetros para a função

### Resultado esperado
- De **6+ requests sequenciais** para **2 requests paralelos** (stats + página atual)
- Carregamento quase instantâneo independente do volume de dados
- Filtros e paginação processados no banco (muito mais rápido)

