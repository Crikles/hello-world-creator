# Remover Push Web do painel MagnusFrete

A funcionalidade de Push Notification tem duas faces no projeto:

1. **Painel Admin Magnus** — uma página `/admin/push` (AdminPush) usada para enviar push manualmente / gerenciar templates.
2. **Rastreio público** (`/rastreio`) — onde o cliente final recebe o prompt para aceitar notificações sobre o pedido (`NotificationPrompt`), service worker (`/sw.js`) e edge functions (`save-push-subscription`, `send-push-notification`).

A solicitação é tirar o Push **da MagnusFrete**, ou seja, da parte administrativa. O recurso para o cliente final na página de rastreio continua intacto (ele não roda em domínio Magnus de qualquer forma).

## O que será removido

- Item de menu **"Push Web"** em `src/components/admin/AdminSidebar.tsx`.
- Rota `/admin/push` e import em `src/App.tsx`.
- Arquivo `src/pages/admin/AdminPush.tsx`.

## O que NÃO será mexido (intencional)

- `src/components/NotificationPrompt.tsx` e uso em `src/pages/Rastreio.tsx` — é o prompt para o cliente final, sem relação com Magnus.
- `public/sw.js`, `src/main.tsx` (registro do SW) — necessários para o push do rastreio.
- Edge functions `save-push-subscription` e `send-push-notification` — usadas pelo rastreio.
- Tabelas `push_subscriptions`, `push_notification_log`, `push_notification_settings`, `push_templates` — mantidas (o rastreio depende delas; remover quebraria assinaturas existentes).
- Segredos `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — continuam necessários para o push do cliente final.

## Confirmação

Quer manter o `PushNotificationPrompt.tsx` (componente antigo/duplicado, não referenciado em lugar nenhum) ou aproveito e apago junto? Posso deletar — está órfão.
