

# Corrigir produtos nos webhooks: mostrar todos os itens do pedido

## Problema

Todos os 5 webhooks (Shopify, Vega, Zedy, Luna, Corvex) salvam apenas o **primeiro produto** no campo `envio.produto`:

```typescript
const firstProduct = normalizedProducts[0] || {};
produto: firstProduct.title || "Produto Vega",
quantidade: firstProduct.quantity || 1,
```

Se o cliente pediu 5 camisetas diferentes, apenas 1 aparece. O campo `pedidos.products` tem todos os itens corretos (JSON array), mas o `envio.produto` recebe apenas o nome do primeiro.

## Solucao

O frontend (`formatProduto`) ja suporta JSON no formato `[{ nome, quantidade }]`. Basta salvar todos os produtos como JSON string no `envio.produto` e somar as quantidades no `envio.quantidade`.

### Mudanca em todos os 5 webhooks:

Substituir:
```typescript
const firstProduct = normalizedProducts[0] || {};
// ...
produto: firstProduct.title || "Produto ...",
quantidade: firstProduct.quantity || 1,
```

Por:
```typescript
const produtoJson = JSON.stringify(
  normalizedProducts.map((p: any) => ({
    nome: p.title,
    quantidade: p.quantity || 1,
  }))
);
const totalQuantidade = normalizedProducts.reduce(
  (sum: number, p: any) => sum + (p.quantity || 1), 0
);
// ...
produto: produtoJson || "Produto ...",
quantidade: totalQuantidade || 1,
```

### Arquivos modificados:

1. `supabase/functions/shopify-webhook/index.ts`
2. `supabase/functions/webhook-vega/index.ts`
3. `supabase/functions/webhook-zedy/index.ts`
4. `supabase/functions/webhook-luna/index.ts`
5. `supabase/functions/webhook-corvex/index.ts`

### Impacto:
- Novos pedidos mostrarao todos os produtos corretamente
- Pedidos antigos continuam funcionando (formatProduto trata string pura como fallback)
- Nenhuma mudanca no frontend necessaria

