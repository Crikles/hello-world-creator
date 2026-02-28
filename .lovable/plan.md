
# Fix: Loading infinito no AuthContext

## Problema raiz

O `onAuthStateChange` faz uma query async (verificacao de `blocked`) dentro do listener. Isso causa:

1. Evento `SIGNED_IN` dispara -> seta `loading=true` -> inicia query async ao banco
2. Outros eventos auth (`TOKEN_REFRESHED`, `INITIAL_SESSION`) podem disparar durante a query e sao bloqueados pelo guard `isCheckingBlocked`
3. Se multiplos eventos se cruzam, `loading` fica preso em `true` para sempre
4. `ProtectedRoute` ve `loading=true` e mostra spinner infinito

## Solucao

Simplificar o `onAuthStateChange` para **nunca fazer operacoes async**. Ele deve apenas atualizar o state de forma sincrona. A verificacao de `blocked` ja e feita em dois lugares seguros:

- **Login.tsx**: verifica `blocked` antes de navegar (ja implementado)
- **getSession**: verifica `blocked` na carga inicial (ja implementado)

## Alteracao

**Arquivo**: `src/contexts/AuthContext.tsx`

Reescrever o `useEffect` para:

```text
useEffect(() => {
  // 1. Listener simples e sincrono - sem queries async
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }
  );

  // 2. Carga inicial com verificacao de blocked
  supabase.auth.getSession().then(async ({ data: { session } }) => {
    if (session?.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("blocked")
        .eq("id", session.user.id)
        .maybeSingle();
      if (profile?.blocked) {
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }
    }
    setSession(session);
    setUser(session?.user ?? null);
    setLoading(false);
  });

  return () => subscription.unsubscribe();
}, []);
```

Mudancas principais:
- Remover toda logica de `isCheckingBlocked` e query async do `onAuthStateChange`
- Listener apenas sincroniza o state
- Trocar `.single()` por `.maybeSingle()` no `getSession` para evitar erro se perfil nao existir
- Manter a verificacao de `blocked` no Login.tsx (ja existente) e no `getSession` (carga inicial)
