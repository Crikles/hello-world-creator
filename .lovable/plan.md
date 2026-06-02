## Objetivo
Resolver as 10 alertas do scanner mantendo todos os fluxos atuais (push, signup SMS, upload de logo, batch progress, admin) funcionando.

## 1. `push_notification_log` (ERROR)
Hoje: policy `ALL` com `true/true` → qualquer logado lê/altera.
Uso real: insert é feito por `send-push-notification` (service_role bypassa RLS) e leitura é no `AdminPush.tsx`.
**Fix:** remover policy permissiva e criar apenas:
- `SELECT` para admins (`has_role(auth.uid(),'admin')`)
- `ALL` para `service_role`

## 2. `push_notification_settings` (ERROR)
Hoje: `ALL true/true`. Uso: leitura/escrita no `AdminPush.tsx` e leitura na edge.
**Fix:** substituir por:
- `SELECT` para `authenticated` (necessário para qualquer painel renderizar config global; não há dado sensível além de URLs de ícone)
- `INSERT/UPDATE/DELETE` apenas para admins
- `ALL` para `service_role`

## 3. `push_subscriptions` (ERROR)
Hoje: `SELECT true` + `INSERT true` públicos → expõe endpoints e chaves criptográficas a qualquer um.
Uso real: `save-push-subscription` e `send-push-notification` usam **service_role** (bypassa RLS); `AdminPush.tsx` lê como admin.
**Fix:** remover policies públicas e criar apenas:
- `SELECT` para admins
- `ALL` para `service_role`
(O cliente nunca insere direto — sempre via edge function.)

## 4. `batch_progress` Realtime (WARN)
Hoje: tabela com RLS por `user_owns_loja` mas o canal Realtime aceita qualquer logado.
**Fix:** habilitar RLS em `realtime.messages` (se ainda não) e criar policy permitindo subscribe somente quando o `topic` corresponde a uma `loja_id` que o usuário possui. Padrão: topic `batch_progress:<loja_id>`.
- Verificar se o front usa esse formato de topic; se não, ajustar `useBatchProgress`/similares antes de publicar a policy.

## 5. `signup_verifications` (WARN)
Hoje: apenas admins. O usuário nunca lê esta tabela — toda verificação passa pelas edges (`send-verification-sms`, `verify-sms-code`) com service_role.
**Fix:** marcar como *not applicable* no scanner (`ignore` com justificativa: tabela é puramente server-side; expor `code` ao usuário seria pior). Sem mudança de schema.

## 6. Bucket `logos` upload aberto (WARN)
Hoje: `INSERT/UPDATE` em `storage.objects` filtrando só `bucket_id='logos'` → qualquer um envia.
Uso: `Empresa.tsx` faz upload com path `logo_<timestamp>.ext` (não usa pasta do usuário).
**Fix:**
- Mudar o path no front para `${auth.uid()}/logo_<ts>.ext`.
- Recriar policies:
  - `INSERT/UPDATE/DELETE` para `authenticated` exigindo `(storage.foldername(name))[1] = auth.uid()::text`.
  - `SELECT` continua público (bucket precisa servir as logos publicamente).

## 7. Bucket público permite listagem (WARN)
Bucket `logos` é público e o `SELECT` atual permite `LIST`.
**Fix:** trocar policy SELECT para permitir somente leitura de objeto individual (sem `LIST`) — na prática `bucket_id='logos' AND name IS NOT NULL` continua liberando GET por URL, e remover a permissão de list via Storage API restringindo a policy.
(Alternativa segura: deixar como está pois o conteúdo é não-sensível e marketing/logo, mas o pedido foi corrigir — vamos restringir o LIST a admins.)

## 8 & 9. Funções SECURITY DEFINER executáveis por anon/authenticated (WARN)
Funções como `get_admin_debit_diagnostics`, `get_admin_user_activity`, `debit_user_credits`, `get_my_debit_blocks`, `get_loja_*`, `get_envios_*`, `get_confirmacao_*`, `try_create_envio_dedupe`, `assign_default_role`, `create_user_credits`, `handle_new_user`, `check_max_lojas`, `generate_tracking_code`, `update_updated_at_column`.
**Fix:**
- Manter `EXECUTE` em `anon, authenticated` apenas para `has_role` e `user_owns_loja` (usadas em policies).
- `REVOKE EXECUTE ... FROM anon, authenticated` nas demais e `GRANT EXECUTE ... TO authenticated` somente nas que o front chama via RPC: confirmar lista com `rg "supabase.rpc\("` antes de aplicar. Funções de admin recebem grant para `authenticated` mas já validam `has_role` internamente.
- Triggers (`handle_new_user`, `assign_default_role`, `create_user_credits`, `update_updated_at_column`, `check_max_lojas`, `generate_tracking_code`) → revogar de anon/authenticated; rodam só como trigger.

## 10. "RLS Policy Always True" (WARN)
Coberto pelos itens 1, 2, 3 (push tables). Após o fix some.

## Ordem de execução
1. Levantar lista exata de `supabase.rpc(...)` chamadas no front (read-only).
2. Migration única com:
   - Drop/recreate policies das 3 tabelas push.
   - Drop/recreate policies do bucket `logos` (`storage.objects`).
   - Realtime policy para `batch_progress`.
   - Bloco de `REVOKE/GRANT EXECUTE` nas funções.
3. Pequeno commit no front: mudar path do upload de logo para `${userId}/...`.
4. Marcar finding #5 (`signup_verifications`) como *ignored* com explicação.
5. Rodar scanner de novo para confirmar.

## Riscos
- Realtime do batch_progress pode quebrar se topic não bater com `loja_id`. Verificaremos antes.
- Qualquer RPC do front que esteja chamando funções definer perde acesso — por isso o passo 1 é obrigatório antes da migration.
- Logos existentes ficam acessíveis (URL pública). Apenas novos uploads usarão a pasta `userId/`.
