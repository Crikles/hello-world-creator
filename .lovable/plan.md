

## Revisão Geral do Sistema Magnus — Últimos 7 dias

### Saúde geral (operacional)
| Métrica | Valor | Status |
|---|---|---|
| Envios criados | 11.051 | OK |
| E-mails enviados / entregues | 10.046 / 9.481 (94%) | OK |
| E-mails com falha definitiva | 18 | OK |
| WhatsApp enviados | 140 | OK (volume baixo) |
| Webhooks não processados | 0 | OK |
| Cashback pendentes >1d | 0 | OK |
| Receita PIX (15 recargas) | R$ 1.664,00 | OK |

**Conclusão**: o pipeline principal (envios → e-mail → entrega) está operando dentro do esperado, com taxa de entrega 94%.

---

### Problemas identificados (precisam ação)

#### 1. Conta `backupativado@gmail.com` — 9.196 envios travados sem progresso
- 17.987 envios totais, **9.196 com `ultimo_evento_ordem = 0` (nunca avançaram)**
- Saldo atual: R$ 0,08 (basicamente zerado)
- **Causa**: saldo insuficiente — fluxo bloqueado pelo `debit_user_credits`
- Os envios estão sendo importados mas nunca processados

#### 2. Fila de WhatsApp — 938 falhas por "Nenhuma instância conectada"
- 99% das falhas WA na semana são porque não há instância UAZAPI ativa para a loja no momento do disparo
- Sistema de fallback existe mas não está cobrindo esses casos

#### 3. Confirmação de pagamento — 3.319 falhas em 7 dias
Top causas:
- **1.203 SMS**: `CREDIT_NOT_DEBITED` (saldo zero — falha esperada, mas ruído alto)
- **995 e-mail + 994 SMS**: `Saldo insuficiente`
- **127 e-mails**: `rate_limit_exceeded` da Resend (5 req/s) — limitador real

#### 4. Bug histórico de avanço em massa pós-recarga (3 ocorrências)
Detectado em consultas (>20 consumos em 5 min após recarga PIX):
- 22/04 — `vercarosuporte@gmail.com`: **368 consumos** em 5 min após recarga
- 18/04 — `backupativado@gmail.com`: **190 consumos** em 5 min após recarga
- 23/04 — `rodrigosantosderesendejunior@gmail.com`: 110 consumos (este já reembolsado)

Os 2 primeiros casos são **anteriores à correção** aplicada hoje em `retry-failed-sends/index.ts`. A partir da correção, o padrão NÃO deve mais ocorrer — mas esses 2 usuários nunca foram reembolsados.

---

### Plano de ação proposto

**A. Reembolsos retroativos** (com base na auditoria)
- `vercarosuporte@gmail.com`: +368 moedas (ajuste manual)
- `backupativado@gmail.com`: +190 moedas (ajuste manual)
- Registrar transações `tipo='ajuste'` com descrição: "Reembolso retroativo — bug de avanço em massa pré-correção"

**B. Melhorias no `send-email` (rate limit Resend)**
- Adicionar throttle/queue interno para respeitar limite de 5 req/s da Resend
- Implementar retry automático em erros 429 com backoff exponencial
- Reduzir as 127 falhas de rate limit a praticamente zero

**C. Limpeza de log de falhas redundantes**
- No `send-sms` e `send-email`: quando `debit_user_credits` retornar false (saldo insuficiente), **não criar** entrada em `confirmacao_pagamento_log` como `failed`. Criar apenas como `skipped_no_credit` ou simplesmente não inserir.
- Reduzirá ~2.200 entradas de falha "Saldo insuficiente" por semana (são esperadas, não bugs)

**D. Aviso de saldo baixo (preventivo)**
- Quando saldo do usuário < custo de 100 envios, disparar:
  - Notificação WhatsApp via UAZAPI admin para o telefone do usuário
  - E-mail de aviso "Sua conta está com saldo baixo, recarregue para evitar interrupções"
- Evitaria casos como `backupativado` com 9k envios travados

**E. Monitor admin: avanços anômalos pós-recarga**
- Adicionar painel em `/admin/dashboard` que detecta automaticamente o padrão "≥20 consumos em 5 min após recarga PIX" e alerta o admin
- Garantia adicional contra regressões do bug corrigido

### Arquivos afetados
- `supabase/functions/send-email/index.ts` (rate limit + skip-on-no-credit)
- `supabase/functions/send-sms/index.ts` (skip-on-no-credit)
- `supabase/functions/advance-shipments/index.ts` (aviso de saldo baixo)
- Nova edge function `low-balance-alert/index.ts`
- `src/pages/admin/AdminDashboard.tsx` (painel de anomalias)
- 2 ajustes manuais via SQL em `creditos` + `creditos_transacoes`

### O que NÃO está sendo alterado
- Lógica de avanço (`triggerNextEmail` / `advance-shipments`) — já corrigida
- Cron de 5 min — funcionando corretamente
- Webhooks de checkout — 0 não processados, OK

