## Problema

No cadastro novo, o cliente recebe o código WhatsApp mas:
1. **"Código inválido"** — mesmo digitando o código que recebeu
2. **"Fica parado"** — digita o código certo e a tela não avança para a etapa de confirmação de e-mail

## Causa raiz (após auditar `verify-sms-code` + `send-verification-sms` + `SmsCodeInput`)

### Bug 1 — Corrida de múltiplos códigos pendentes (causa o "código inválido")
Toda chamada ao `send-verification-sms` **insere uma nova linha** em `signup_verifications` com status `pendente`. Quando o cliente clica em "Reenviar" (ou o front-end dispara o envio duas vezes por race), ficam **várias linhas pendentes** para o mesmo telefone.

O `verify-sms-code` busca `.order(created_at desc).limit(1)` — ou seja, só aceita o **código MAIS NOVO**. Se o WhatsApp do cliente entregou o código antigo primeiro (ou ele digitou o que chegou primeiro), o sistema responde "Código incorreto".

Pior: existe um auto-verify no front (`useEffect` quando `code.length === 6`) que dispara **enquanto o usuário ainda está colando** dígito por dígito em alguns navegadores → marca tentativa como errada → loop.

### Bug 2 — Trava silenciosa após verificação OK (causa o "fica parado")
No `SmsCodeInput.handleVerify`, quando a resposta é `verified: true`:
- `hasAdvancedRef.current = true` → `onVerified()` é chamado **uma vez**
- `onVerified` → `handleSmsVerified` → `await onSignup(...)` (Supabase `auth.signUp`)

Se o `signUp` falhar silenciosamente (ex.: e-mail já cadastrado de tentativa anterior, rate-limit do Supabase auth, erro de rede), `handleSignup` em `Signup.tsx` retorna `false` e volta para o `form`. Mas se o `signUp` **resolve sem error e sem session** (caso "Email already exists" virou `data.user = null` sem erro — comportamento padrão do Supabase para evitar enumeration), nada acontece: nem toast, nem mudança de tela. Usuário fica preso no passo SMS com o código já validado.

Além disso, o `verifying` state vira `false` no finally, então a UI fica idêntica à inicial — sem qualquer pista de que algo aconteceu.

### Bug 3 — Falha silenciosa do envio WhatsApp
Quando UAZAPI está desconectado, o envio falha mas a função retorna `success: true` (o catch do bloco WhatsApp é não-bloqueante). Cliente nunca recebe código e pensa que o sistema está bugado.

## Correções

### 1. Em `supabase/functions/send-verification-sms/index.ts`
- Antes de inserir nova linha, marcar todas as `pendentes` do mesmo telefone como `superseded` (ou simplesmente deletar/expirar) — garante uma única "fonte da verdade".
- Se UAZAPI retornar status ≠ `connected` ou o `/send/text` falhar, **retornar erro 503** ao front em vez de `success: true`. Assim o usuário vê "WhatsApp temporariamente indisponível, tente novamente" e não fica esperando.

### 2. Em `supabase/functions/verify-sms-code/index.ts`
- Mudar a busca: aceitar **qualquer linha pendente e não expirada** do telefone cujo `code` bate (em vez de pegar só a `latest`). Resolve o caso de múltiplos códigos válidos.
- Após verificação OK, marcar todas as outras pendentes do telefone como `expirado` para limpar.

### 3. Em `src/components/ui/premium-auth.tsx` (`SmsCodeInput` + `handleSmsVerified`)
- Remover auto-verify por `useEffect` (causa disparo precoce) → verificar **apenas no `onPaste` completo** ou via botão. Manter typing manual sem auto-submit.
- Em `handleSmsVerified`: mostrar estado de loading ("Criando conta...") enquanto `onSignup` roda, e se voltar para o form, exibir toast explicando o motivo.
- Em `Signup.tsx handleSignup`: tratar o caso `data.user && !data.session && data.user.identities?.length === 0` (assinatura típica de "e-mail já existe") com mensagem clara "Este e-mail já está cadastrado, faça login".

### 4. Diagnóstico imediato (antes da correção definitiva)
Vou primeiro puxar os logs de `send-verification-sms` e `verify-sms-code` do cliente afetado (telefone do screenshot: 5581992093310) para confirmar qual dos 3 bugs ele bateu — assim aplico exatamente o fix necessário sem chutar.

## Resumo do que será alterado

- `supabase/functions/send-verification-sms/index.ts` — supersede de pendentes + retorno de erro real quando WhatsApp falha
- `supabase/functions/verify-sms-code/index.ts` — aceitar qualquer pending+code válido + cleanup
- `src/components/ui/premium-auth.tsx` — remover auto-verify, mostrar loading no `handleSmsVerified`
- `src/pages/Signup.tsx` — tratar caso "e-mail já existe" silencioso do Supabase

Quer que eu siga com esse plano, ou prefere que eu rode primeiro o diagnóstico nos logs do telefone do print para confirmar antes de mexer?