

## Plano: Corrigir bug de auto-avanço na verificação SMS

### Problema identificado
A edge function `verify-sms-code` verifica se existe **qualquer** registro antigo com status `"verificado"` para aquele telefone. Quando um usuário tenta se cadastrar com um número que já foi verificado anteriormente (por ele mesmo ou outra tentativa), o sistema:

1. **Polling (check_only)**: Encontra o registro antigo verificado → retorna `verified: true` imediatamente
2. **Verificação direta**: Mesma lógica nas linhas 87-107 → retorna `verified: true` sem checar o código

Resultado: o usuário envia o SMS, e em menos de 5 segundos o polling detecta o registro antigo e avança direto para a tela de email.

### Correção
Alterar `verify-sms-code` para verificar apenas o **registro mais recente** daquele telefone. Se o mais recente for `"pendente"` (acabou de ser criado pelo `send-verification-sms`), retornar `false` — mesmo que existam registros antigos verificados.

### Alteração em `supabase/functions/verify-sms-code/index.ts`

**check_only (linhas 43-85)**: Em vez de buscar qualquer registro verificado, buscar o registro mais recente (independente de status). Só retornar `verified: true` se o mais recente tiver status `"verificado"`.

**Verificação direta (linhas 87-107)**: Remover o bloco que retorna `verified: true` para registros antigos verificados. O código deve sempre ser validado contra o registro pendente.

```text
Antes:
  check_only → busca QUALQUER "verificado" → encontra antigo → true ❌
  verify     → busca QUALQUER "verificado" → encontra antigo → true ❌

Depois:
  check_only → busca O MAIS RECENTE → se status="pendente" → false ✅
  verify     → sempre valida código contra registro pendente → correto ✅
```

### Arquivo
- `supabase/functions/verify-sms-code/index.ts`

