

## Alterar domínio de envio dos e-mails de rastreio

### Situação atual
- O domínio padrão (fallback) no código é `noreply@jltransportes.pro` (linha 1138 de `send-email/index.ts`)
- Cada loja pode ter um `email_remetente` customizado na tabela `postagem_config`, que sobrescreve o padrão
- O domínio `holdingtransportesbr.com` já está verificado na Resend

### Alteração

**Arquivo:** `supabase/functions/send-email/index.ts`

Mudar o fallback padrão de:
```typescript
let emailRemetente = "noreply@jltransportes.pro";
```
Para:
```typescript
let emailRemetente = "noreply@holdingtransportesbr.com";
```

Depois, fazer deploy da Edge Function `send-email`.

### Resultado
- Todos os e-mails de rastreio passam a sair de `noreply@holdingtransportesbr.com` por padrão
- Lojas que têm `email_remetente` customizado na configuração continuam usando o delas
- Nenhuma outra alteração necessária

