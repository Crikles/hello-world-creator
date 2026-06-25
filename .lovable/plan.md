# Bug no fluxo de cadastro — UI trava após validar WhatsApp

## Diagnóstico

Após reproduzir o fluxo nos logs (4 tentativas seguidas de `babebr8@gmail.com` com SMS verificado mas `/signup` retornando **422** até finalmente passar), o problema **não está no envio nem na validação do código WhatsApp** — esses passos funcionam. O bug está no que acontece **depois** que o código é aceito:

1. Usuário digita os 6 dígitos → `verify-sms-code` marca `signup_verifications.status='verificado'`.
2. `SmsCodeInput` dispara `onVerified()` e seta `hasAdvancedRef.current = true` (trava qualquer nova tentativa).
3. `handleSmsVerified` chama `supabase.auth.signUp(...)`.
4. Se o `signUp` falha (ex.: `User already registered` porque o e-mail já foi usado numa tentativa anterior, senha fraca, e-mail fora dos domínios permitidos pelo trigger `validate_signup_email_domain`, etc.):
   - O `Signup.tsx` apenas exibe `toast.error(error.message)`.
   - `signupSuccess` permanece `false`, então a UI **continua na tela de "Verificação WhatsApp"** com `hasAdvancedRef=true`.
   - O usuário fica travado: o código já foi consumido, não há botão pra avançar, e re-digitar não faz nada porque o ref já está bloqueado.

Resultado visível pro usuário: "validei o WhatsApp e nada acontece, a conta não é criada e o e-mail de confirmação nunca chega".

## Causa secundária

`handle_new_user` (trigger no `auth.users`) busca a verificação pelo `phone` do `raw_user_meta_data`. Como o front-end normaliza o telefone com `replace(/\D/g, '')` antes do `signUp`, o match funciona — mas se o usuário trocou o número entre tentativas, o cadastro novo pode acabar com `whatsapp_verified=false` silenciosamente (não é a causa principal do travamento, mas vale tratar).

## Correção

### 1. `src/components/ui/premium-auth.tsx` — propagar falha do signUp pra UI

- `handleSmsVerified`: aguardar o resultado de `onSignup` e, se falhar, **resetar** `hasAdvancedRef`, voltar para `signupStep='form'` e exibir mensagem clara ("Não foi possível concluir o cadastro. Verifique seus dados e tente novamente.").
- Adicionar estado `signupError` no `SmsCodeInput` para mostrar inline (e não só toast) quando o pai informar que falhou.

### 2. `src/pages/Signup.tsx` — devolver sucesso/erro

- Mudar `handleSignup` para retornar `boolean` (ou lançar) em vez de só setar state, para que `premium-auth.tsx` saiba se deve voltar pro form.
- Em caso de erro, **não consumir** a verificação: como o status já foi marcado `verificado` no banco, o próximo `signUp` com o mesmo telefone ainda casa no trigger `handle_new_user` (sem efeito colateral negativo).

### 3. Melhoria de robustez no `SmsCodeInput`

- Parar o polling (`setInterval`) imediatamente após `onVerified()` ser chamado (já é feito, mas garantir cleanup em re-render quando voltarmos para o form).
- Permitir resetar `hasAdvancedRef` quando o componente recebe sinal de erro do pai (via nova prop opcional `resetSignal`).

### 4. Mensagens de erro amigáveis em PT

Mapear erros comuns do Supabase pro português antes de exibir:
- `User already registered` → "Este e-mail já está cadastrado. Faça login."
- `Password should be at least 6 characters` → "A senha precisa ter no mínimo 6 caracteres."
- `Apenas emails Gmail, Hotmail, Outlook ou Proton são permitidos` → manter (já vem em PT do trigger).

## Fora de escopo

- Não vou mexer no `verify-sms-code`, `send-verification-sms` nem no `handle_new_user` — os logs mostram que estão funcionando.
- Não vou alterar política de domínios de e-mail permitidos.

## Validação após implementar

1. Tentar cadastrar com e-mail já existente → deve voltar pro form com mensagem clara, em vez de travar na tela do WhatsApp.
2. Cadastrar normalmente → SMS → conta criada → tela "Verifique seu e-mail" aparece → e-mail de confirmação enviado.
3. Inspecionar `auth.users` e confirmar que `profiles.whatsapp_verified=true` para o novo usuário.
