

## Plano: Corrigir Reenvio de Emails Falhados + Garantir Entrega

### Problema identificado

O botão "Reenviar Falhas (32)" mostra 32 registros na tabela, mas a edge function `resend-daily-emails` deduplica por `envio_id + evento_id`, reduzindo para apenas 2 combinações únicas. O restante são registros duplicados (mesmo envio+evento que já foi reenviado e voltou a dar bounce).

O UI mostra **todos** os registros brutos, mas a function envia apenas os **únicos** — daí a discrepância.

### Correções

**1. `resend-daily-emails/index.ts` — Remover dedup agressiva + adicionar retry inteligente**
- Remover a deduplicação por `envio_id + evento_id` que está descartando registros válidos
- Em vez disso, buscar apenas o **último registro** de cada `envio_id + evento_id` — se o último status for `bounced` ou `failed`, reenviar
- Usar query com `ORDER BY created_at DESC` e dedup para pegar apenas os mais recentes (evita reenviar algo que já foi reenviado com sucesso)
- Para emails que fazem bounce repetidamente (ex: icloud.com inválido), limitar a **máximo 2 tentativas por dia** para o mesmo destinatário — evita gastar créditos em emails que nunca vão chegar

**2. `AdminEmailSaude.tsx` — Sincronizar contagem do botão com a realidade**
- O botão deve mostrar a contagem do dry_run (deduplicated), não a contagem bruta da tabela
- Ao clicar "Reenviar", primeiro faz dry_run, mostra o total real e confirma
- Na tabela de "Falhas de Hoje", agrupar registros duplicados do mesmo destinatário+etapa mostrando um contador "(x2)" em vez de linhas repetidas
- Isso deixa claro quantos emails únicos existem vs quantas tentativas falharam

**3. Estratégia para garantir entrega**
- **Bounced** (ex: `@icloud.com`): O email do cliente é inválido ou caixa cheia — reenviar não resolve. Marcar visualmente na tabela como "Email inválido — sem solução" após 2 bounces
- **Failed**: Erro técnico no envio — reenviar pode resolver. Priorizar esses
- Na tabela, adicionar coluna "Tentativas" para mostrar quantas vezes já foi reenviado
- Adicionar um indicador visual: verde = vale tentar, vermelho = email provavelmente inválido (bounce repetido)

### Arquivos alterados
- `supabase/functions/resend-daily-emails/index.ts` — lógica de dedup + retry limit
- `src/pages/admin/AdminEmailSaude.tsx` — contagem sincronizada + agrupamento + indicadores visuais

