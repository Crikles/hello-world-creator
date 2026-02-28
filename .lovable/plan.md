

# Gerar tokens aleatorios para webhooks por loja

## Problema

Atualmente, a URL do webhook usa o `slug` da loja (ex: `?loja=minha-loja`). Se o usuario renomear a loja, o slug muda e todos os webhooks configurados nos checkouts param de funcionar.

## Solucao

Criar um token unico e imutavel por loja, usado exclusivamente nas URLs de webhook. Mesmo que o nome/slug da loja mude, o token permanece o mesmo.

Exemplo de URL atual:
```text
.../functions/v1/webhook-vega?loja=minha-loja
```

Exemplo de URL nova:
```text
.../functions/v1/webhook-vega?token=a1b2c3d4e5f6
```

## Alteracoes

### 1. Migracao no banco de dados

Adicionar coluna `webhook_token` na tabela `lojas`:
- Tipo `text`, unique, not null
- Default: gera automaticamente um token aleatorio de 12 caracteres hex via `encode(gen_random_bytes(6), 'hex')`
- Backfill para lojas existentes com tokens gerados

### 2. Atualizar todas as Edge Functions de webhook (5 funcoes)

Arquivos afetados:
- `supabase/functions/webhook-vega/index.ts`
- `supabase/functions/webhook-zedy/index.ts`
- `supabase/functions/webhook-luna/index.ts`
- `supabase/functions/webhook-corvex/index.ts`
- `supabase/functions/shopify-webhook/index.ts`

Em cada uma, trocar:
- Query param de `?loja=SLUG` para `?token=TOKEN`
- Resolver loja por `webhook_token` em vez de `slug`

```text
// Antes
const lojaSlug = url.searchParams.get("loja");
.eq("slug", lojaSlug)

// Depois
const token = url.searchParams.get("token");
.eq("webhook_token", token)
```

### 3. Atualizar a UI de integracoes

No `src/pages/Integracoes.tsx`:
- Buscar o `webhook_token` da loja (ja disponivel no contexto LojaContext ou via query)
- Montar a URL com `?token=TOKEN` em vez de `?loja=SLUG`

### 4. Atualizar o LojaContext

Incluir o campo `webhook_token` na interface `Loja` para que esteja disponivel em toda a aplicacao.

## Detalhes tecnicos

### Token

- 12 caracteres hexadecimais (6 bytes aleatories = 2^48 combinacoes)
- Gerado automaticamente na criacao da loja via DEFAULT do Postgres
- Imutavel apos criacao (nao exposto para edicao pelo usuario)
- Constraint UNIQUE para garantir unicidade

### Migracao SQL

```sql
ALTER TABLE lojas 
  ADD COLUMN webhook_token text 
  DEFAULT encode(gen_random_bytes(6), 'hex') 
  NOT NULL 
  UNIQUE;
```

Lojas existentes receberao tokens automaticamente pelo DEFAULT.

