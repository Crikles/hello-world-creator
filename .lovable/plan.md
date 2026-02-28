

# Fix: Login nao funciona devido a race condition no AuthContext

## Problema

Quando o usuario faz login:
1. `signInWithPassword` dispara o evento `SIGNED_IN`
2. O handler do `onAuthStateChange` inicia uma consulta async ao banco para verificar `blocked`
3. Enquanto isso, `handleLogin` em Login.tsx chama `navigate("/lojas")`
4. O `ProtectedRoute` verifica: `user=null` e `loading=false` --> redireciona de volta para `/login`
5. O usuario nunca consegue passar da tela de login

## Solucao

No handler do `onAuthStateChange`, setar `loading=true` imediatamente ao receber o evento `SIGNED_IN` antes de fazer a consulta async. Isso faz o `ProtectedRoute` mostrar o spinner enquanto a verificacao de bloqueio ocorre, em vez de redirecionar para `/login`.

## Alteracao

**Arquivo**: `src/contexts/AuthContext.tsx`

Na linha 30, logo apos detectar `event === "SIGNED_IN"`, adicionar `setLoading(true)` antes de setar `isCheckingBlocked`:

```text
if (event === "SIGNED_IN" && session?.user) {
  setLoading(true);  // <-- adicionar esta linha
  isCheckingBlocked = true;
  ...
```

Isso garante que o `ProtectedRoute` mostra o spinner enquanto a verificacao de bloqueio esta em andamento, evitando o redirecionamento prematuro para `/login`.

