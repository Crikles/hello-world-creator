

## Plan: Cashback Automático para Emails Não Entregues

### Conceito

Quando um envio completa o fluxo (status "entregue"), o sistema verifica na tabela `postagem_email_log` se **nenhum** email daquele envio teve status `delivered` (confirmado pelo webhook da Resend). Se todos os emails falharam (bounced/failed) ou nenhum foi confirmado como entregue, o sistema devolve automaticamente os créditos cobrados no início do fluxo.

### Por que esperar o fluxo terminar

A Resend envia webhooks com status reais (`delivered`, `bounced`, `complained`). Um email pode demorar para ser confirmado. Ao esperar o último evento do fluxo, temos certeza de que todos os emails já tiveram tempo de ser processados e seus status atualizados.

### Mudanças

**1. Nova tabela `cashback_log`** (migração)
- `id`, `envio_id`, `loja_id`, `user_id`, `valor_devolvido`, `motivo`, `created_at`
- Registra cada devolução para auditoria e evita cashback duplicado (unique em `envio_id`)

**2. Nova função SQL `process_cashback`** (migração)
- Recebe `envio_id` e `user_id`
- Consulta `postagem_email_log` para aquele `envio_id`
- Se nenhum registro tem status `delivered` ou `opened` ou `clicked`, calcula o valor a devolver
- Credita de volta na tabela `creditos` e registra em `creditos_transacoes` e `cashback_log`
- Retorna o valor devolvido (0 se não aplicável)

**3. Edge Function `advance-shipments` (alteração)**
- Quando o cron avança um envio para status `entregue`, chama `process_cashback` via RPC
- Log do resultado

**4. Client-side `email-trigger.ts` (alteração)**
- Quando `triggerNextEmail` resulta em status `entregue`, chama `process_cashback` via RPC
- Exibe toast informando o cashback se aplicável

**5. Painel Admin — Visualização de cashbacks**
- Adicionar seção no Dashboard admin ou página dedicada mostrando cashbacks processados (total devolvido, lista recente)

### Lógica de verificação

```text
Envio chegou a "entregue"
  └─ Consultar postagem_email_log WHERE envio_id = X
     └─ Se NENHUM registro com status IN ('delivered','opened','clicked')
        └─ Devolver créditos (email + taxação + falha, exceto SMS já cobrado à parte)
        └─ Registrar em cashback_log
     └─ Se PELO MENOS UM delivered → sem cashback
```

### Arquivos envolvidos

| Arquivo | Ação |
|---------|------|
| Migração SQL | Criar tabela `cashback_log` + função `process_cashback` |
| `supabase/functions/advance-shipments/index.ts` | Chamar cashback ao atingir "entregue" |
| `src/lib/email-trigger.ts` | Chamar cashback ao atingir "entregue" |
| `src/pages/admin/AdminDashboard.tsx` | Card com total de cashbacks |

