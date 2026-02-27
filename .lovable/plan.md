

# Deploy da Integração Shopify

## Contexto
Os arquivos da integração Shopify ja existem no projeto (edge functions, pagina Integracoes.tsx, migration SQL). Os erros de build ocorrem porque a tabela `shopify_integrations` ainda nao existe no banco, entao o TypeScript nao reconhece esse nome nas queries do Supabase.

## Etapas

### 1. Criar a tabela `shopify_integrations` no banco
Executar a migration que ja esta no arquivo `20260227224634_create_shopify_integrations.sql` usando a ferramenta de migration. Isso cria a tabela com RLS, trigger de `updated_at` e indice. Apos a migration, o arquivo `types.ts` sera regenerado automaticamente e os erros de TypeScript serao resolvidos.

### 2. Corrigir temporariamente os erros de TypeScript em `Integracoes.tsx`
Enquanto os tipos nao forem regenerados, adicionar casts `as any` nas chamadas `.from("shopify_integrations")` para eliminar os erros de build. Isso garante que o app compila imediatamente. Quando os tipos forem atualizados, os casts poderao ser removidos.

### 3. Atualizar `supabase/config.toml` para desabilitar JWT nas edge functions
As duas edge functions Shopify precisam de `verify_jwt = false` porque recebem chamadas externas (redirect OAuth e webhooks). O config.toml atual tem `verify_jwt = true` -- sera alterado para `false`.

### 4. Deploy das Edge Functions
Fazer deploy de `shopify-auth-callback` e `shopify-webhook`. Ambas ja existem no projeto e estao prontas.

### 5. Adicionar secret `FRONTEND_URL`
A edge function `shopify-auth-callback` usa `Deno.env.get("FRONTEND_URL")` para redirecionar apos o OAuth. Sera necessario configurar esse secret com a URL publicada do projeto (`https://magnusfrete.lovable.app`).

---

### Detalhes tecnicos

**Migration SQL** (ja existente no projeto):
```sql
CREATE TABLE public.shopify_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE UNIQUE,
    shop_url TEXT NOT NULL,
    client_id TEXT NOT NULL,
    client_secret TEXT NOT NULL,
    access_token TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- RLS, trigger e indice incluidos
```

**Integracoes.tsx** -- correcoes de tipo:
- Usar `(supabase as any).from("shopify_integrations")` ou cast nos resultados para contornar a falta de tipos ate a regeneracao.

**config.toml** -- alteracoes:
```toml
[functions.shopify-auth-callback]
verify_jwt = false

[functions.shopify-webhook]
verify_jwt = false
```

**Ordem de execucao:**
1. Migration do banco
2. Fix de tipos no Integracoes.tsx
3. Atualizar config.toml
4. Deploy das edge functions
5. Configurar secret FRONTEND_URL

