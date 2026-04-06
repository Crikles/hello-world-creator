

## Plano: Corrigir envios mostrando "Manual" em vez do checkout correto

### Diagnóstico

O problema é o **limite de 1000 linhas do Supabase**. A query na linha 287-291 do `Envios.tsx` busca todos os `pedidos` com `envio_id` vinculado, mas existem **12.342 pedidos** linkados. Como o Supabase retorna no máximo 1000 por request, os envios além dos primeiros 1000 ficam sem mapeamento e aparecem como "Manual".

### Alteração

**1. `src/pages/Envios.tsx` — Corrigir query de pedidos (linhas 283-304)**

Implementar paginação na busca de pedidos para carregar todos os registros:

```typescript
queryFn: async () => {
  if (!loja) return { origemMap: {}, metodoMap: {} };
  const origemMap: Record<string, string> = {};
  const metodoMap: Record<string, string> = {};
  
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("pedidos")
      .select("envio_id, checkout_provider, method")
      .eq("loja_id", loja.id)
      .not("envio_id", "is", null)
      .range(from, from + pageSize - 1);
    
    if (error || !data || data.length === 0) break;
    
    for (const p of data) {
      if (p.envio_id) {
        origemMap[p.envio_id] = p.checkout_provider;
        if (p.method) metodoMap[p.envio_id] = p.method;
      }
    }
    
    if (data.length < pageSize) break;
    from += pageSize;
  }
  
  return { origemMap, metodoMap };
},
```

### Resultado esperado
- Todos os 12.342+ pedidos vinculados serão carregados
- Envios criados via checkout (Vega, Zedy, Luna, Corvex, Adoorei) mostrarão o nome correto do checkout e método de pagamento
- Nenhum envio de checkout aparecerá como "Manual" incorretamente

