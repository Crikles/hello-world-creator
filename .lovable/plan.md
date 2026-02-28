
# Adicionar funcionalidade de Bloquear/Excluir usuários no painel admin

## Visao geral

Adicionar botoes de "Bloquear" e "Excluir" na tabela de usuarios do painel admin (`AdminUsuarios.tsx`), com uma Edge Function no backend para executar essas operacoes de forma segura usando o service_role.

## 1. Adicionar coluna `blocked` na tabela `profiles`

Nova migration para adicionar o campo que controla se o usuario esta bloqueado:

```sql
ALTER TABLE public.profiles ADD COLUMN blocked boolean NOT NULL DEFAULT false;
```

## 2. Criar Edge Function `admin-manage-user`

Nova edge function em `supabase/functions/admin-manage-user/index.ts` que recebe:
- `action`: `"block"` | `"unblock"` | `"delete"`
- `target_user_id`: ID do usuario alvo

A funcao vai:
- Verificar se o chamador e admin (consultando `user_roles`)
- Impedir que o admin exclua/bloqueie a si mesmo
- **Bloquear**: Atualizar `profiles.blocked = true` e invalidar a sessao do usuario via `auth.admin.updateUserById(id, { banned_until: 'forever' })`
- **Desbloquear**: Atualizar `profiles.blocked = false` e remover o ban via `auth.admin.updateUserById(id, { banned_until: null })`
- **Excluir**: Remover o usuario completamente via `auth.admin.deleteUser(id)` (isso cascadeia para profiles, user_roles, creditos, etc. devido aos FK com `ON DELETE CASCADE` no auth.users)

## 3. Atualizar a pagina `AdminUsuarios.tsx`

Adicionar na tabela de usuarios:
- Coluna "Status" mostrando badge "Ativo" (verde) ou "Bloqueado" (vermelho)
- Botoes de acao: "Bloquear/Desbloquear" e "Excluir"
- Dialog de confirmacao com AlertDialog antes de excluir (acao irreversivel)
- Dialog de confirmacao antes de bloquear

## 4. Verificar bloqueio no login

Atualizar o `AuthContext.tsx` ou a pagina de `Login.tsx` para verificar se o usuario esta bloqueado apos o login e, se estiver, fazer signOut automatico e exibir mensagem de erro.

## Detalhes tecnicos

- A exclusao de usuario via `auth.admin.deleteUser()` requer `SUPABASE_SERVICE_ROLE_KEY` (ja configurado nos secrets)
- O ban via `auth.admin.updateUserById()` impede o usuario de fazer login mesmo com credenciais validas
- Tabelas relacionadas sem `ON DELETE CASCADE` (lojas, envios, etc.) precisarao de limpeza manual na edge function antes de deletar o usuario
- A interface UserRow ganhara o campo `blocked: boolean`
