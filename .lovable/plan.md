

# Correção: Produtos exibindo JSON bruto no Dashboard

## Problema
Na seção "Últimas Atualizações" do Dashboard, o campo `produto` está sendo exibido diretamente como JSON bruto (ex: `[{"nome":"Camiseta Oversized...","quantidade":1}]`) ao invés de formatado.

## Causa
O `Dashboard.tsx` (linha ~230) renderiza `{envio.produto}` diretamente, sem usar a função `formatProduto` que já existe em `src/lib/format-produto.ts` e trata exatamente esse caso.

## Solução
1. Importar `formatProduto` de `@/lib/format-produto` no `Dashboard.tsx`
2. Substituir `{envio.produto}` por `{formatProduto(envio.produto)}` na seção de últimas atualizações

Uma alteração de 2 linhas.

