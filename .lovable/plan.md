

## Diagnóstico: Dashboard lenta e com delay

### Problemas identificados

**1. Delay no carregamento:**
O dashboard faz **3 consultas pesadas** que buscam TODOS os envios da loja no client-side:
- **Faturamento**: busca todos os registros em loops de 1.000 para somar `valor` (ex: yaveh = 2.133 registros = 3 requests)
- **Gráfico**: busca todos os registros com `valor` e `created_at` em loops de 1.000
- **Contagens**: 5 queries paralelas (mais leve, usa `count: exact`)

Para a loja yaveh com 2.133 envios, são pelo menos **9 requests HTTP** antes do dashboard renderizar.

**2. Gráfico com aparência estranha:**
O formato de data `dd/MM` (sem ano) faz com que dados de anos diferentes se misturem no mesmo ponto. Além disso, mostrar TODOS os dados históricos sem filtro deixa o gráfico muito denso.

### Solução proposta

**A. Criar uma database function para faturamento (elimina loops):**
```sql
CREATE FUNCTION get_loja_faturamento(p_loja_id uuid)
RETURNS numeric AS $$
  SELECT COALESCE(SUM(valor), 0) FROM envios 
  WHERE loja_id = p_loja_id AND deleted_at IS NULL
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

**B. Criar uma database function para dados do gráfico (agregação server-side):**
```sql
CREATE FUNCTION get_loja_chart_data(p_loja_id uuid)
RETURNS TABLE(dia date, receita numeric, pedidos bigint) AS $$
  SELECT created_at::date, SUM(valor), COUNT(*) FROM envios
  WHERE loja_id = p_loja_id AND deleted_at IS NULL
  GROUP BY created_at::date ORDER BY created_at::date
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

**C. Atualizar Dashboard.tsx:**
- Substituir o loop de faturamento por `supabase.rpc('get_loja_faturamento', { p_loja_id })`
- Substituir o loop do gráfico por `supabase.rpc('get_loja_chart_data', { p_loja_id })`
- Formatar datas do gráfico como `dd/MM/yy` para distinguir anos
- Resultado: de **9+ requests** para **4 requests** (faturamento, chart, counts, recent)

### Resultado esperado
- Dashboard carrega 3-5x mais rápido
- Gráfico mostra datas com ano para evitar sobreposição
- Menos carga no banco e no client

