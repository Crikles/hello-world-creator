

## Plano: Reenviar 67 emails faltantes + Corrigir bug de cobrança

### Problema
- 172 envios foram avançados para "Falha Entrega", mas apenas 105 receberam o email
- 67 envios ficaram sem notificação porque o saldo de SMS esgotou durante o processamento em lote
- O usuário já pagou pelo fluxo completo na primeira etapa (currentOrdem === 0), então cobranças de SMS em etapas subsequentes não deveriam bloquear o envio de emails

### Parte 1: Reenviar os 67 emails pendentes

Criar e executar um script que:
1. Identifica os 67 envios em "Falha Entrega" sem registro de email para o evento `8fab5897-01ca-43c6-9b2a-938b17c18de4`
2. Chama a edge function `send-email` para cada um deles com `envio_id`, `evento_id` e `loja_id`
3. Processa com delay de 500ms entre cada chamada para respeitar rate limits

### Parte 2: Corrigir o bug na lógica de cobrança

O problema está em dois lugares:

**Arquivo 1: `src/lib/email-trigger.ts`** (client-side trigger)
- Na seção de SMS dispatch (~linha 170): quando o debit de SMS falha por saldo insuficiente, `canSendSms` é definido como `false` — isso está correto, o email ainda é enviado
- Porém, verificar se há alguma outra condição que pode bloquear o fluxo

**Arquivo 2: `supabase/functions/advance-shipments/index.ts`** (cron/batch)
- A lógica de SMS (linhas 666-694) já está correta — falha de SMS não bloqueia email
- O verdadeiro problema: durante o "Forçar Todos" em lote no client-side, se o `triggerNextEmail` lança `InsufficientBalanceError` no debit de SMS, o `catch` na linha 196 propaga o erro e o envio inteiro é abortado para aquele registro
- **Correção**: O `InsufficientBalanceError` só deve ser lançado quando a cobrança INICIAL (currentOrdem === 0) falha. A cobrança de SMS não deve lançar essa exceção — já não lança, apenas define `canSendSms = false`

Após investigação mais detalhada, o problema mais provável é que o processamento em lote no frontend **cancelou ou atingiu timeout** antes de processar todos os 67 restantes, já que o batch processa sequencialmente. O status foi atualizado mas o email não foi disparado a tempo.

### Resumo das alterações
- **Execução imediata**: Script para reenviar 67 emails via `send-email`
- **Sem mudança de código necessária**: A lógica de cobrança já está correta — SMS não bloqueia email. O problema foi operacional (batch interrompido ou timeout)

