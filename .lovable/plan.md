

# Corrigir limite de 1000 registros no Dashboard e Envios

## Problema
As queries do Dashboard e Envios usam `.select("*")` sem paginação recursiva, limitadas a 1000 rows pelo default do Supabase. O screenshot mostra exatamente 1000 pedidos quando há mais.

## Solução

### 1. Dashboard — usar contagem server-side
Em vez de buscar todos os registros para contar, usar `select("id", { count: "exact", head: true })` para os cards de contagem, e uma query separada apenas para o chart e últimas atualizações (que precisam de dados reais, mas limitados).

**Cards (Total, Pendentes, Em Trânsito, Entregues):**
- 4 queries com `count: "exact", head: true` e filtros por status
- Faturamento: `select("valor")` com fetch recursivo em lotes de 1000

**Chart (últimos 7 dias):** query filtrada por data (últimos 7 dias) — nunca excede 1000.

**Últimas Atualizações:** já limita a 6, basta adicionar `.limit(6)`.

### 2. Envios — fetch recursivo
A listagem de Envios precisa de todos os registros para filtro client-side e seleção. Implementar fetch recursivo em lotes de 1000:

```typescript
async function fetchAllEnvios(lojaId: string) {
  const all = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("envios")
      .select("*")
      .eq("loja_id", lojaId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
```

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/pages/Dashboard.tsx` | Cards usam count queries; faturamento com fetch recursivo; chart filtrado por 7 dias; últimas atualizações com `.limit(6)` |
| `src/pages/Envios.tsx` | Query principal usa fetch recursivo em lotes de 1000 |

