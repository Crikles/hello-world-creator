## Diagnóstico

Os emails de atualização de pedidos pararam de ser enviados. Verifiquei os logs e a base de dados:

**Volume de emails (postagem_email_log) nas últimas 24h:**
- `06/05 14h–23h`: ~100 emails/h entregues (operação normal)
- `07/05 00h`: 166 entregues (pico)
- `07/05 01h em diante`: caiu para ~10–40/h
- `07/05 08h–09h`: apenas ~16 entregues por hora
- **Últimas 4 horas (10h–13h)**: praticamente zero registros novos de envio

**Volume de envios avançados (tabela envios) últimas 4h**: continua alto (84–174 envios/h sendo movidos para `em_transito`). Ou seja, o cron `advance-shipments` está rodando normalmente — o problema é que o disparo de email está falhando.

**Causa raiz nos logs da edge function `send-email`:**
```
2026-05-07T13:57:26Z ERROR Auth failed: invalid claim: missing sub claim
```
Esse erro está repetindo a cada chamada nas últimas horas. A função `send-email` valida o token assim:
1. Compara `token === SUPABASE_SERVICE_ROLE_KEY` (string match exato)
2. Se não bater, tenta `auth.getUser(token)` — que falha com "missing sub claim" porque o token de service role **não tem** claim `sub` (é um token de role, não de usuário).

A função `advance-shipments` (cron de 5 min) cria o client com `SUPABASE_SERVICE_ROLE_KEY` e chama `supabase.functions.invoke("send-email", ...)`. O token enviado é o service role, mas a comparação `===` está falhando — provavelmente porque o secret `SUPABASE_SERVICE_ROLE_KEY` na função `send-email` está dessincronizado do que o `supabase-js` está enviando (rotação ou formato novo de chave publishable/secret).

Resultado: todo email disparado pelo cron retorna **401 Unauthorized** silenciosamente. O `advance-shipments` apenas loga o erro e continua, então os envios avançam mas nenhum email sai.

## Correção

### 1. Validar service role pelo claim, não por string match
Em `supabase/functions/send-email/index.ts` (linhas 1084–1106), substituir a comparação de string por uma decodificação do JWT:
- Decodifica o payload do JWT (base64)
- Se `payload.role === "service_role"` → trata como server-to-server (pula `getUser`)
- Caso contrário, valida com `getUser` normalmente

Isso elimina a dependência da string exata do secret e funciona mesmo após rotações ou troca para o novo formato de chaves do Supabase.

### 2. Aplicar a mesma correção nas demais funções que recebem invocação server-to-server
Verificar e corrigir o mesmo padrão em:
- `resend-nfe/index.ts`
- `resend-daily-emails/index.ts`
- `send-sms/index.ts` (também é chamada pelo `advance-shipments`)
- `send-whatsapp/index.ts`
- `send-payment-confirmation/index.ts`

### 3. Reenviar emails perdidos das últimas 4 horas
Após o deploy, identificar todos os `envios` que avançaram entre 10h e 14h UTC de hoje cujo evento atual tinha `enviar_email = true` e que **não** possuem registro em `postagem_email_log` para aquele evento, e disparar o email manualmente via `send-email` (com `skip_debit: true` para não cobrar duplicado).

## Observação para o usuário

O problema afeta **todas as contas/lojas** simultaneamente — não é específico de nenhum lojista. Após o deploy a operação volta ao normal automaticamente, e o reenvio cobre o backlog.