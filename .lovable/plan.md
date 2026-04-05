

## Plano: Remover deduplicação de leads na Recuperação de Vendas

### Problema
A deduplicação atual bloqueia leads com mesmo email + loja + tipo nas últimas 24h. Isso impede que um cliente que gere múltiplos PIX receba a recuperação para cada um.

### Alterações

**1. `supabase/functions/webhook-vega/index.ts`** (linhas 178-188)
- Remover o bloco de deduplicação que verifica `recovery_leads` por email+loja+tipo nas últimas 24h
- O lead será sempre inserido, independente de existir outro recente

**2. `supabase/functions/webhook-recovery/index.ts`** (linhas 132-148)
- Remover o bloco de deduplicação equivalente (mesmo email + loja + tipo em 24h)
- O lead será sempre inserido

**3. Redeployar** ambas as edge functions

### Resultado
Cada evento de PIX gerado (ou carrinho abandonado) criará um novo lead e disparará email/SMS, mesmo que o cliente já tenha gerado outro PIX antes.

