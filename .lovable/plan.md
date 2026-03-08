

# Correção: PIX com dados do admin durante impersonação

## Problema
Quando o admin usa "Login como" para acessar a conta de um usuário e gera um PIX, o JWT pertence ao admin. A Edge Function usa `user.id` do JWT para buscar o perfil e registrar o pagamento, resultando no PIX com dados do admin no gateway BlackCat.

## Alterações

### 1. `src/pages/Moedas.tsx` (linhas 42-44, 131-134)
- Importar `isImpersonating` do `useAuth()`
- No body do fetch, adicionar `target_user_id: isImpersonating ? user?.id : undefined`

### 2. `supabase/functions/create-pix-payment/index.ts` (linhas 45-63)
Após autenticar o caller e extrair o body:
- Se `target_user_id` estiver presente e for diferente de `user.id`:
  - Verificar na tabela `user_roles` se o caller é admin
  - Se não for admin, retornar 403
  - Se for admin, usar `target_user_id` como `effectiveUserId`
- Usar `effectiveUserId` no lugar de `user.id` para: buscar perfil, inserir `pix_payments`, e no metadata

```typescript
const { amount_cents, moedas, target_user_id } = body;

let effectiveUserId = user.id;
if (target_user_id && target_user_id !== user.id) {
    const { data: adminRole } = await supabase
        .from("user_roles").select("role")
        .eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!adminRole) {
        return new Response(JSON.stringify({ error: "Sem permissão" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
    effectiveUserId = target_user_id;
}
```

Depois substituir todas as referências a `user.id` por `effectiveUserId` nas queries de profile e insert de `pix_payments`.

