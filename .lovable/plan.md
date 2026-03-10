

# Integração Adoorei - Correções Necessárias

## Problemas Encontrados

### 1. config.toml faltando entrada para webhook-adoorei
A function `webhook-adoorei` **não está registrada** no `supabase/config.toml` com `verify_jwt = false`. Isso significa que requisições externas (webhooks da Adoorei) serão rejeitadas por exigir JWT.

### 2. Items sem campo `name`
O payload da Adoorei nos `items` só tem `source_reference`, `quantity` e `price` -- **não tem `name`**. O código atual faz `p.name || "Produto Adoorei"`, que sempre vai cair no fallback. Não é um bug crítico, mas o produto ficará como "Produto Adoorei" para todos os itens.

### 3. Campo `complement` e `country` ausentes no payload
O payload da Adoorei não tem `complement` nem `country` no address. O código já trata com fallback, está ok.

## Plano de Correção

### A. Adicionar webhook-adoorei ao config.toml
Adicionar `[functions.webhook-adoorei]` com `verify_jwt = false`.

### B. Melhorar normalização de produtos
Usar `source_reference` como nome do produto quando `name` não existir, já que é a única identificação disponível. O produto no envio ficará como "Produto #REF" ao invés de "Produto Adoorei" genérico para todos.

### C. Corrigir zipcode com hífen
O payload mostra `"zipcode": "11111-111"` com hífen. O CEP precisa ser limpo (remover não-dígitos) antes de salvar no envio.

## Resumo das Mudanças

| Arquivo | Mudança |
|---|---|
| `supabase/config.toml` | Adicionar `[functions.webhook-adoorei]` verify_jwt = false |
| `supabase/functions/webhook-adoorei/index.ts` | Melhorar nome do produto, limpar CEP |

