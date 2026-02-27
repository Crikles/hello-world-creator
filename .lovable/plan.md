

# Configurar Push Notifications (Tabelas, Secrets e Edge Functions)

## 1. Criar 3 tabelas via migracao SQL

Uma unica migracao com:

**`push_subscriptions`** -- armazena as subscricoes dos navegadores
- `id` UUID PK, `endpoint` TEXT UNIQUE NOT NULL, `keys_p256dh`, `keys_auth`, `codigo_rastreio` nullable, `created_at`
- RLS: INSERT e SELECT publicos (anon + authenticated)

**`push_notification_settings`** -- configuracoes globais de push
- `id` UUID PK, `icon_url`, `badge_url`, `default_url`, `created_at`, `updated_at`
- RLS: SELECT, INSERT e UPDATE publicos
- Inserir 1 registro padrao com valores default

**`push_notification_log`** -- historico de notificacoes enviadas
- `id` UUID PK, `title`, `body`, `url`, `icon_url`, `total_sent`, `total_failed`, `created_at`
- RLS: SELECT e INSERT publicos

## 2. Gerar e configurar VAPID keys

As VAPID keys sao necessarias para autenticar o servidor ao enviar push notifications via Web Push Protocol.

- Nao e possivel executar `npx web-push generate-vapid-keys` dentro do Lovable. Em vez disso, vou gerar as chaves usando uma edge function temporaria ou orientar voce a gerar externamente.
- **Acao necessaria do usuario**: Voce precisara fornecer as chaves VAPID (publica e privada) para que eu as configure como secrets (`VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY`).
- A chave publica tambem sera exposta no frontend via variavel `VITE_VAPID_PUBLIC_KEY` -- porem como o `.env` e gerenciado automaticamente, ela sera hardcoded no codigo ou em uma constante.

## 3. Criar e fazer deploy das edge functions

Criar os arquivos (que ja estao definidos no contexto do projeto):

- **`supabase/functions/save-push-subscription/index.ts`** -- recebe subscription do browser e salva no banco
- **`supabase/functions/send-push-notification/index.ts`** -- envia push para todas as subscricoes usando VAPID

Adicionar as configuracoes no `supabase/config.toml`:
```toml
[functions.save-push-subscription]
verify_jwt = false

[functions.send-push-notification]
verify_jwt = false
```

## Sequencia de execucao

1. Criar migracao SQL com as 3 tabelas + RLS + registro padrao
2. Solicitar ao usuario as VAPID keys (publica e privada) via ferramenta de secrets
3. Criar os 2 arquivos de edge functions
4. Fazer deploy das edge functions

## Observacao importante

A chave publica VAPID precisa estar acessivel no frontend para registrar o service worker. Como o `.env` nao pode ser editado manualmente, a chave sera armazenada como constante no codigo (ex: em um arquivo de configuracao ou diretamente no componente `PushNotificationPrompt`).

