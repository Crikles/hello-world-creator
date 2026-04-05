

## Plano: Corrigir valor do PIX Vega + SMS

### Problemas identificados

**1. Valor exibido como R$500 em vez de R$5,00**

A Vega envia `total_price: 500` e `product.amount: 500` em **centavos** (R$5,00 = 500 centavos). O código no arquivo faz `totalPrice / 100`, mas o valor no banco está como 500 -- indica que a versão deployada da function não tem a divisão. Solução: garantir a conversão correta e redeployar.

Adicionalmente, o produto está salvo com `value: 0` apesar de `amount: 500` no payload. Preciso investigar por que `(p.amount || 0) / 100` resulta em 0 -- possivelmente o tipo do campo está como string na runtime.

**2. SMS não enviado -- sem créditos**

O log da function `send-recovery-sms` mostra:
```
SMS API response: 400 {"error":1,"code":"CREDIT_NOT_DEBITED","message":"Credit not debited"}
```
A API da IntegraX rejeitou por falta de créditos. **Isso não é bug de código** -- é necessário recarregar créditos na plataforma de SMS.

### Alterações

**`supabase/functions/webhook-vega/index.ts`**

1. Forçar conversão numérica explícita no `amount` dos produtos:
   - `value: Number(p.amount || 0) / 100` (garante que não é string)

2. Adicionar log de diagnóstico para o totalPrice antes de salvar no recovery_leads

3. Redeployar a function para garantir que o código atualizado esteja em produção

### Resultado esperado
- Valores corretos: produto R$5,00 e total R$5,00
- SMS: informar o usuário que precisa recarregar créditos na IntegraX

