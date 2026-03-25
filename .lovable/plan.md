

## Plano: Verificação SMS + Email no Cadastro ✅ IMPLEMENTADO

### Fluxo Implementado

```text
1. Usuário preenche nome, WhatsApp, email, senha
2. Clica "Enviar Código SMS" → gera código 6 dígitos → envia SMS via IntegraX
3. Tela de inserção do código SMS aparece (6 inputs com auto-complete)
4. Código correto → cadastro no Supabase Auth (com email verification)
5. Tela de "Verifique seu email" aparece (fluxo atual)

Admin: vê verificações pendentes com código visível e pode aprovar manualmente
Admin: pode confirmar email de qualquer usuário
```

### Arquivos criados/modificados

| Arquivo | Ação |
|---------|------|
| Migração SQL | Tabela `signup_verifications` com RLS |
| `supabase/functions/send-verification-sms/index.ts` | Edge function - gera e envia código SMS |
| `supabase/functions/verify-sms-code/index.ts` | Edge function - valida código |
| `supabase/functions/admin-manage-user/index.ts` | Ações `confirm_email` e `approve_sms` |
| `src/components/ui/premium-auth.tsx` | Step de código SMS com auto-verify |
| `src/pages/admin/AdminUsuarios.tsx` | Seção de verificações pendentes + botão confirmar email |
