

# Corrigir Envio de E-mails - Diagnostico e Solucao

## Problemas Identificados

### Problema 1: Edge Function `send-email` usa metodo inexistente `auth.getClaims()`

Na linha 87 de `supabase/functions/send-email/index.ts`, o codigo usa `anonClient.auth.getClaims()` que **nao existe** no Supabase JS SDK v2. Isso faz a funcao crashar silenciosamente (sem logs), retornando 500 antes de processar qualquer coisa.

A solucao correta e usar `auth.getUser()` para validar o token.

### Problema 2: Join `empresas(*)` pode falhar sem FK

A query `envios.select("*, empresas(*)")` em `email-trigger.ts` depende de um foreign key entre `envios.empresa_id` e `empresas.id`. Caso nao exista, o PostgREST retorna erro. Precisamos garantir que o FK existe.

### Problema 3: Sem logs de diagnostico

Nenhuma mensagem de log aparece na edge function, o que confirma que o crash acontece antes de qualquer processamento.

---

## Plano de Correcao

### 1. Corrigir autenticacao na Edge Function (`supabase/functions/send-email/index.ts`)

Substituir o bloco `getClaims` (linhas 80-93) por `getUser`:

```typescript
// Verify user via token
const anonClient = createClient(
  SUPABASE_URL,
  Deno.env.get("SUPABASE_ANON_KEY")!,
  { global: { headers: { Authorization: authHeader } } }
);
const { data: userData, error: userError } = await anonClient.auth.getUser();
if (userError || !userData?.user) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

### 2. Criar FK entre `envios.empresa_id` e `empresas.id` (migracao SQL)

```sql
ALTER TABLE public.envios
  ADD CONSTRAINT envios_empresa_id_fkey
  FOREIGN KEY (empresa_id) REFERENCES public.empresas(id)
  ON DELETE SET NULL;
```

### 3. Adicionar logs de diagnostico no `email-trigger.ts`

Adicionar `console.log` em pontos-chave para facilitar debug futuro:
- Antes de invocar a edge function
- Apos receber resposta

### Arquivos a modificar

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/send-email/index.ts` | Trocar `getClaims` por `getUser` |
| Migracao SQL | Criar FK `envios.empresa_id -> empresas.id` |
| `src/lib/email-trigger.ts` | Adicionar logs de diagnostico |

