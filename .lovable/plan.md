

## Plano: Verificação SMS + Email no Cadastro

### Fluxo Proposto

```text
1. Usuário preenche nome, WhatsApp, email, senha
2. Clica "Criar Conta" → gera código 6 dígitos → envia SMS via IntegraX
3. Tela de inserção do código SMS aparece
4. Código correto → cadastro no Supabase Auth (com email verification)
5. Tela de "Verifique seu email" aparece (fluxo atual)

Admin: vê todos os códigos pendentes e pode aprovar manualmente
```

### Mudanças

**1. Nova tabela `signup_verifications` (migração)**
- Campos: `id`, `phone`, `email`, `name`, `password_hash` (NÃO armazenar senha em texto), `code` (6 dígitos), `status` (pendente/verificado/expirado), `created_at`, `expires_at`, `verified_at`, `approved_by`
- Nota importante: NÃO podemos armazenar a senha do usuário antes do cadastro. Em vez disso, o fluxo será:
  - Gerar e enviar código SMS
  - Usuário confirma o código
  - Só então criar a conta no Supabase Auth
  - O formulário mantém os dados em memória (state) até a verificação

Tabela simplificada:
- `id`, `phone`, `email`, `full_name`, `code` (6 dígitos), `status`, `created_at`, `expires_at`, `verified_at`, `approved_by`
- RLS: admin full access, service_role full access, sem acesso público direto

**2. Nova Edge Function `send-verification-sms`**
- Recebe: `phone`, `email`, `full_name`
- Gera código de 6 dígitos aleatório
- Salva na tabela `signup_verifications`
- Envia SMS via IntegraX (mesma API já usada)
- Mensagem: "Seu código de verificação Magnus Frete: XXXXXX"
- Código expira em 10 minutos
- Rate limiting: máximo 3 tentativas por telefone em 10 min

**3. Nova Edge Function `verify-sms-code`**
- Recebe: `phone`, `code`
- Valida código contra tabela
- Retorna `{ verified: true }` se correto e não expirado
- Marca como `verificado`

**4. Modificar fluxo de Signup (`premium-auth.tsx` + `Signup.tsx`)**
- Adicionar novo estado/step no formulário:
  - Step 1: Formulário normal (nome, WhatsApp, email, senha)
  - Step 2: Tela de inserção do código SMS (6 inputs)
  - Step 3: Sucesso SMS → criar conta no Supabase Auth → tela de verificação email
- Os dados do formulário ficam em memória até SMS ser verificado
- Botão "Reenviar SMS" com cooldown de 60s

**5. Painel Admin - Nova seção em AdminUsuarios ou nova página**
- Listar verificações pendentes com: nome, telefone, email, código, data
- Botão "Aprovar" para o admin marcar como verificado manualmente
- Quando admin aprova, o frontend do usuário (se ainda aberto) detecta e prossegue
- Alternativa: admin pode aprovar a verificação de email dos usuários também (usando a edge function `admin-manage-user` para confirmar email)

**6. Admin pode confirmar email de usuários**
- Adicionar ação "Confirmar Email" no `admin-manage-user` edge function
- Usa `supabase.auth.admin.updateUserById(userId, { email_confirm: true })`
- Botão visível no painel de usuários

### Arquivos envolvidos

| Arquivo | Ação |
|---------|------|
| Migração SQL | Criar tabela `signup_verifications` |
| `supabase/functions/send-verification-sms/index.ts` | Nova edge function |
| `supabase/functions/verify-sms-code/index.ts` | Nova edge function |
| `supabase/functions/admin-manage-user/index.ts` | Adicionar ação `confirm_email` |
| `src/components/ui/premium-auth.tsx` | Adicionar step de código SMS |
| `src/pages/Signup.tsx` | Integrar novo fluxo |
| `src/pages/Login.tsx` | Integrar novo fluxo no signup embutido |
| `src/pages/admin/AdminUsuarios.tsx` | Seção de verificações pendentes + botão confirmar email |

### Considerações de Segurança
- Códigos expiram em 10 minutos
- Máximo 3 tentativas por telefone a cada 10 minutos
- Senha nunca é armazenada fora do Supabase Auth
- Tabela de verificação acessível apenas via service_role e admin

