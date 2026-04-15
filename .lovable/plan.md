

## Plano: Recuperação automática de pagamentos PIX pendentes

### Problema
O polling de verificação de pagamento só roda enquanto o usuário está na página de Moedas. Se ele sai da página antes da confirmação, o `setInterval` é cancelado e as moedas nunca são creditadas — mesmo que o PIX tenha sido pago na CyberPay.

### Solução
Criar um **cron job server-side** que verifica periodicamente todos os pagamentos PIX pendentes diretamente na CyberPay e credita automaticamente quando aprovados. Isso garante que nenhum pagamento seja perdido, independente do comportamento do usuário no frontend.

### Alterações

**1. Nova Edge Function: `cron-check-pending-pix/index.ts`**
- Busca todos os `pix_payments` com `status = 'PENDING'` e `transaction_id IS NOT NULL` criados nas últimas 24h
- Para cada um, faz `GET /payments/transactions/{transaction_id}` na CyberPay
- Se `status === "APPROVED"`: executa a mesma lógica de creditação que já existe no `check-pix-payment` (marcar PAID, adicionar moedas, comissão de indicação 10%, webhooks de notificação)
- Proteção de idempotência: só processa se status ainda é `PENDING`
- Sem autenticação JWT (será invocado por cron)

**2. Configurar cron no `supabase/config.toml`**
- Agendar execução a cada 2 minutos via `[functions.cron-check-pending-pix]` com schedule `*/2 * * * *`
- Usar `pg_cron` ou invocação HTTP periódica

**3. Melhoria no frontend (`src/pages/Moedas.tsx`)**
- Ao abrir a página, verificar se existe algum `pix_payment` pendente do usuário e retomar o polling automaticamente (caso ele tenha saído e voltado)

### Fluxo novo
```text
Usuário paga PIX e sai da página → polling frontend para
Cron (a cada 2min) → busca PENDING → consulta CyberPay → APPROVED? → credita moedas
Usuário volta à página → vê saldo atualizado
```

### Impacto
- Pagamentos nunca mais serão perdidos por saída prematura da página
- Cron processa apenas pagamentos das últimas 24h para limitar scope
- Sem alteração no fluxo existente — apenas uma rede de segurança adicional

