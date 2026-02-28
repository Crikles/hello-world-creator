

# Persistir Status das Integrações de Checkout no Banco de Dados

## Problema
Os checkouts Vega, Zedy, Luna e Corvex usam apenas `useState` local para controlar se estao ativos ou nao. Isso significa que:
1. Ao recarregar a pagina ou navegar para outra, o estado se perde
2. O dashboard nao consegue ler o status dessas integracoes porque nao existe dado no banco
3. O contador de "Ativas/Inativas" tambem se perde

## Solucao

### 1. Criar tabela `checkout_integrations` no banco
Tabela simples para armazenar o estado de cada checkout por loja:

```text
checkout_integrations
- id (uuid, PK)
- loja_id (uuid, NOT NULL)
- checkout_id (text, NOT NULL) -- "vega", "zedy", "luna", "corvex"
- ativo (boolean, DEFAULT false)
- created_at (timestamp)
- updated_at (timestamp)
- UNIQUE(loja_id, checkout_id)
```

Com RLS usando `user_owns_loja` para proteger os dados.

### 2. Atualizar `Integracoes.tsx`
- Substituir o `useState<Record<string, boolean>>` por uma query ao banco (`checkout_integrations`)
- O toggle do Switch fara upsert no banco (INSERT ON CONFLICT UPDATE)
- O contador de Ativas/Inativas incluira tanto Shopify quanto os checkouts

### 3. Atualizar `Dashboard.tsx`
- Adicionar query para `checkout_integrations` filtrando `ativo = true`
- Mostrar "Webhook" como ativo se houver qualquer integracao ativa (Shopify ou checkout)

## Detalhes tecnicos

### Migracao SQL
```sql
CREATE TABLE public.checkout_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL,
  checkout_id text NOT NULL,
  ativo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(loja_id, checkout_id)
);

ALTER TABLE public.checkout_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own loja checkout_integrations"
  ON public.checkout_integrations FOR ALL
  USING (user_owns_loja(auth.uid(), loja_id))
  WITH CHECK (user_owns_loja(auth.uid(), loja_id));
```

### Arquivos alterados
- `src/pages/Integracoes.tsx` -- query + upsert mutation para checkout toggles, contadores corretos
- `src/pages/Dashboard.tsx` -- query `checkout_integrations` para refletir status no canal Webhook

