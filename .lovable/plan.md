

## Compatibilizar Webhook Vega para V1 e V2

### Problema
O webhook atual so extrai produtos de `payload.products` (V2). Na V1, os produtos vem dentro de `payload.plans[].products[]` e nao existe `payload.products`. O codigo atual so faz essa extracao de `plans` quando e `abandoned_cart`, entao vendas normais da V1 ficam sem nome de produto.

Alem disso, na V1 o identificador da transacao e `transaction_id` (nao `transaction_token`).

### Plano

**Arquivo: `supabase/functions/webhook-vega/index.ts`**

1. **Extrair `transactionToken` tambem de `transaction_id`** (V1):
   ```
   const transactionToken = payload.transaction_token 
     || payload.transaction_id 
     || `tx_${Date.now()}`;
   ```

2. **Extrair produtos de `plans` para TODAS as vendas** (nao so abandoned_cart):
   Mover a logica de extracao de `plans[].products[]` para fora do `if (isAbandonedCart)`, aplicando sempre que `products` estiver vazio:
   ```
   let normalizedProducts = products;
   if (!products.length && payload.plans) {
     normalizedProducts = [];
     for (const plan of payload.plans) {
       if (plan.products) {
         for (const p of plan.products) {
           normalizedProducts.push({
             code: p.id,
             title: p.name,
             description: p.description,
             amount: ...,
             quantity: parseInt(String(p.amount || "1"), 10),
           });
         }
       }
     }
   }
   ```

3. **Nenhuma mudanca na UI ou banco** — so ajuste na edge function.

### Resultado
Um unico webhook funciona para V1 e V2: se `products` existe (V2), usa direto; se nao, extrai de `plans` (V1). O `transaction_id` da V1 tambem e reconhecido.

