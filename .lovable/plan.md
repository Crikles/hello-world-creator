
# Corrigir status de Webhook no Dashboard

## Problema
A logica atual na linha 123 do Dashboard considera o webhook como "Ativo" se existir qualquer registro na tabela `shopify_integrations` (mesmo que nao esteja realmente ativo) ou se houver checkout_integrations ativas. O campo `ativo` da tabela shopify_integrations tem default `true`, entao basta o registro existir para mostrar como ativo indevidamente.

## Solucao

Alterar a logica de `webhookAtivo` no `src/pages/Dashboard.tsx` (linha 123) para ser mais rigorosa:

```text
Antes:
  webhookAtivo = (!!shopifyConfig && shopifyConfig.ativo !== false) || checkoutIntegrations.length > 0

Depois:
  webhookAtivo = (!!shopifyConfig && shopifyConfig.ativo === true && !!shopifyConfig.access_token) || checkoutIntegrations.length > 0
```

Isso garante que o Shopify so conta como ativo se:
1. O registro existe
2. O campo `ativo` e explicitamente `true`
3. Possui um `access_token` configurado (integracao real)

Os checkout_integrations ja estao filtrados corretamente pela query (filtra por `ativo=true`).

## Arquivo alterado
- `src/pages/Dashboard.tsx` - Linha 123: ajuste na condicao `webhookAtivo`
