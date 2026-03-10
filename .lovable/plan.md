

# Correções e Deploy: JADLOG + Shopify Webhook

## 1. Corrigir erro de build no `shopify-webhook`

**Arquivo:** `supabase/functions/shopify-webhook/index.ts` (linhas 158-159)

As variáveis `produtoJson` e `totalQuantidade` não existem. Substituir por:
```typescript
produto: normalizedProducts.length > 0
  ? JSON.stringify(normalizedProducts.map((p: any) => ({ nome: p.title, quantidade: p.quantity })))
  : "Produto Shopify",
quantidade: normalizedProducts.reduce((sum: number, p: any) => sum + p.quantity, 0) || 1,
```

## 2. Migração SQL: adicionar coluna `logistica_provider`

Executar migração:
```sql
ALTER TABLE lojas ADD COLUMN IF NOT EXISTS logistica_provider TEXT DEFAULT 'jl';
```

## 3. Deploy das Edge Functions

Fazer deploy de:
- `send-email` (atualizada com branding JADLOG)
- `shopify-webhook` (após correção do build)

