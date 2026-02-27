
# Corrigir Redirect da Integração Shopify

## Problema
A edge function `shopify-auth-callback` redireciona o usuario para `/integracoes` apos o OAuth, mas a rota correta no app e `/loja/{lojaId}/integracoes`. Isso faz o usuario cair em uma pagina 404/NotFound.

## Correcao

### 1. Atualizar `shopify-auth-callback` para incluir o `loja_id` na URL de redirect
O parametro `state` ja contem o `loja_id`. Usaremos ele para construir a URL correta de retorno:

```
/loja/{loja_id}/integracoes
```

Em vez de apenas `/integracoes`.

### 2. Buscar a loja no banco para montar a rota completa
Como o `state` ja e o `loja_id`, basta usar diretamente na URL de redirect:

```typescript
const redirectUrl = `${frontendUrl}/loja/${state}/integracoes`;
```

### Arquivo alterado
- `supabase/functions/shopify-auth-callback/index.ts` -- alterar a construcao do `redirectUrl` para usar o `state` (loja_id) no path.

### Detalhes tecnicos
A linha atual:
```typescript
const redirectUrl = `${Deno.env.get("FRONTEND_URL") || "..."}/integracoes`;
```

Sera alterada para:
```typescript
const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://magnusfrete.lovable.app";
// redirectUrl sera construido apos validar o state (loja_id)
const redirectUrl = `${frontendUrl}/loja/${state}/integracoes`;
```

Todos os `Response.redirect()` ja usam a variavel `redirectUrl`, entao a correcao se aplica automaticamente a todos os cenarios (sucesso e erro).
