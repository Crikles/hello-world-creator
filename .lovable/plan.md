
# Auditoria de segurança — Magnus / Atlas / Jetline

Vou simular um atacante contra o sistema (anônimo, usuário comum logado, lojista de outra conta, scraping de webhooks e widgets públicos) e corrigir cada brecha encontrada. Abaixo está o mapa de vulnerabilidades reais detectadas e o que será corrigido em cada uma.

## 1. Vulnerabilidades já confirmadas pelos scanners

| # | Origem | Risco | Ação |
|---|--------|-------|------|
| 1.1 | `jspdf 4.2.0` — HTML Injection (GHSA-wfv2-pwc8-crg5) | Crítico | Atualizar para `jspdf >=3.0.3 / 4.0.5` (verificar API) ou trocar geração de PDF para `pdfmake`. |
| 1.2 | 29 avisos do Supabase Linter sobre `SECURITY DEFINER` funções executáveis por `anon`/`authenticated` | Médio/Alto | `REVOKE EXECUTE ... FROM anon, public` em todas as funções internas (`assign_default_role`, `handle_new_user`, `seed_global_flow_eventos`, `tg_seed_global_flow_eventos`, `validate_signup_email_domain`, `sync_profile_blocked_to_auth`, `envio_to_lead`, `generate_tracking_code`, `apply_global_flow_on_envio`, `create_user_credits`, `check_max_lojas`, `update_updated_at_column`, `debit_user_credits`, `refund_user_credits`, `try_create_envio_dedupe`, `seed_global_flow_eventos`). Manter `EXECUTE` para `authenticated` somente nas RPC realmente chamadas pelo cliente (`get_envios_paginated`, `get_envios_stats`, `get_loja_chart_data`, `get_loja_faturamento`, `get_confirmacao_grouped`, `get_confirmacao_placar`, `get_my_debit_blocks`, `has_role`, `user_owns_loja`). Funções admin (`get_admin_*`) ficam só com `service_role`. |
| 1.3 | Bucket público `logos` permite listagem | Médio | Restringir policy de `SELECT` em `storage.objects` para o bucket `logos`: leitura pública por path exato, mas sem listagem (remover `LIST` policy aberta). |

## 2. Tentativas de invasão e correções planejadas

### 2.1 Edge Functions sem auth (atacante anônimo)
Ataques: chamar diretamente as URLs e disparar e-mails/SMS, drenar saldo, consultar pedidos alheios.

Funções a revisar e endurecer:

- **`advance-shipments`, `cron-check-pending-pix`, `auto-whatsapp-new-order`, `backfill-*`, `resend-daily-emails`, `retry-failed-sends`, `low-balance-alert`** → exigir header `x-cron-secret` igual a `CRON_SECRET`. Hoje algumas não validam.
- **`send-sms`, `send-recovery-sms`, `send-verification-sms`, `verify-sms-code`** → adicionar rate-limit por IP + por telefone (5 tentativas/15min) e validação `requireAuth` exceto no `send-verification-sms` que precisa ser anônimo. Para o anônimo, rate-limit duro + captcha-like (cooldown 60s).
- **`api-external`** → exigir `Authorization: Bearer <api_key>` validado contra `api_keys` (criar tabela) e rate-limit por chave. Hoje aceita qualquer chamada.
- **`download-nfe`, `resend-nfe`** → exigir auth do dono da loja (validar `loja_id` via `user_owns_loja`).
- **`save-push-subscription`** → exigir auth.
- **`pagamento-info`, `rastreio-info`, `widget-buscar-pedido`, `redirect`** → permanecem públicas (são consultadas pelo cliente final). Adicionar:
  - rate-limit por IP (60 req/min por código).
  - validação rígida do código (regex `^[A-Z0-9]{10,20}$`) para evitar enumeração via SQL pattern.
  - resposta neutra (404 genérico) para códigos inválidos para não vazar existência.
- **Webhooks (`shopify-webhook`, `webhook-cloudfy`, `webhook-vega`, `webhook-adoorei`, `webhook-alphazz`, `webhook-corvex`, `webhook-luna`, `webhook-nuvorafy`, `webhook-zedy`, `webhook-recovery`, `webhook-resend`)** → todos devem validar assinatura HMAC quando o provedor oferece (Shopify já tem `X-Shopify-Hmac-Sha256`, Resend usa Svix). Para os que não têm assinatura, exigir token único por loja (`webhook_token` em `checkout_integrations`).

### 2.2 Frontend / rotas / brute-force
- Reforçar `ProtectedRoute` e `AdminRoute` validando `has_role('admin')` no servidor (RPC) em cada navegação para `/admin/*`, não confiar em cache local.
- `Login.tsx` e `Signup.tsx`: bloquear após 5 falhas/15 min por IP via tabela `auth_attempts`.
- Reset password: garantir que `/reset-password` exige `type=recovery` no hash e invalida link após uso.

### 2.3 RLS revisão
Tabelas críticas a re-auditar (escrever queries de teste como `authenticated` impersonando outro `user_id`):
- `pedidos`, `envios`, `leads`, `recovery_leads`, `live_view_pings`, `confirmacao_pagamento_log`, `whatsapp_message_log`, `sms_log`, `pix_payments`, `creditos`, `creditos_transacoes`, `empresas`, `lojas`, `postagem_config`, `global_flow_config`, `checkout_integrations`, `shopify_integrations`, `whatsapp_instances`.

Para cada uma garantir que toda policy use `user_owns_loja(auth.uid(), loja_id)` ou `auth.uid() = user_id`, sem fallback `true`. Verificar GRANTs (sem `anon` exceto onde explicitamente necessário).

### 2.4 Tabelas com dados sensíveis expostos
- `signup_verifications` (códigos OTP): garantir que `anon` NÃO consegue `SELECT`. Hoje o código verifica via edge function — confirmar que policy bloqueia leitura direta.
- `webhook_logs`, `admin_payment_webhooks`: somente admin.
- `profiles`: política de `SELECT` deve ser `auth.uid() = id` (não pode listar outros usuários).
- `user_roles`: somente leitura via `has_role()`, nunca `SELECT *`.

### 2.5 Storage
- Bucket `logos` (público): apenas leitura por path; sem `LIST`.
- Buckets privados (`pix-qrcodes`, `nfe-pdfs`): confirmar policy de `SELECT` exige `user_owns_loja` via path prefix `loja_id/`.

### 2.6 Headers/HTML
- Adicionar `Content-Security-Policy`, `X-Frame-Options: DENY` (exceto em widget), `Referrer-Policy: strict-origin-when-cross-origin` via `index.html` meta + headers das edge functions.
- Remover qualquer `console.log` de payload sensível em edge functions de SMS/PIX.

## 3. O que será entregue (na fase build)

1. **Migration SQL** com:
   - `REVOKE EXECUTE` em todas as funções internas.
   - Re-`GRANT` mínimo para `authenticated` e `service_role`.
   - Ajuste de policies em buckets `logos`, `pix-qrcodes`, `nfe-pdfs`.
   - Hardening de policies em `profiles`, `signup_verifications`, `user_roles`, `webhook_logs`.
   - Tabela `auth_attempts(ip, type, count, window_start)` para rate-limit.
2. **Edge Functions**:
   - `_shared/rateLimit.ts` reutilizável.
   - `_shared/webhookAuth.ts` (HMAC Shopify / Svix Resend / token de loja).
   - Atualização de cada função listada na seção 2.1.
3. **Frontend**:
   - `LoginAttemptGuard` + mensagens neutras ("credenciais inválidas") sem revelar se e-mail existe.
   - Atualização do `package.json` removendo/atualizando `jspdf`.
   - Headers de segurança em `index.html`.
4. **Documento `SECURITY.md`** com modelo de ameaças e o que foi corrigido.

## 4. Detalhes técnicos

- Funções que viram `SECURITY INVOKER` (mais seguro, ainda funciona): `update_updated_at_column`, `generate_tracking_code`, `apply_global_flow_on_envio` (são triggers; SECURITY DEFINER é desnecessário porque rodam no contexto do owner via trigger).
- `debit_user_credits` / `refund_user_credits` continuam `SECURITY DEFINER` mas com `REVOKE FROM anon, authenticated` (só edge functions com service_role chamam).
- Rate-limit: tabela leve com TTL via `created_at < now() - interval '15 min'`, limpa periodicamente.
- HMAC Shopify: já existe `SHOPIFY_WEBHOOK_SECRET`? Se não, vou pedir o segredo no momento da build.
- Para a chave de API externa, criar `api_keys (id, loja_id, key_hash, created_at, last_used_at, revoked_at)` e validar com `bcrypt`/SHA-256.

## 5. Fora de escopo (apenas aviso)
- Pentest de infraestrutura (Cloudflare/Lovable) — só a plataforma resolve.
- Scripts `/~flock.js` / `/__l5e/*` injetados pelo runtime Lovable.

Aprova esse escopo para eu executar tudo na fase de build? Se quiser, posso fatiar em etapas (1=SQL+RLS, 2=Edge Functions, 3=Frontend) e entregar uma por vez.
