
The scoreboard shows 4899 enviados / 0 pendentes / 4899 total, but the table says "Nenhuma confirmação enviada ainda". So the RPC `get_confirmacao_placar` works but `get_confirmacao_grouped` returns empty (or errors silently).

Likely cause: with 4899+ groups, the RPC scans `confirmacao_pagamento_log` 3 times (latest CTE with DISTINCT ON, totals CTE, and joins) and may be timing out or returning empty due to a subtle filter issue. Also `pedidos.id::text = g.pid_text` join without index on cast may be slow.

Let me check the data and current frontend before planning.

Plan:

## Problema
- Placar mostra 4899 enviados mas tabela vazia → RPC `get_confirmacao_grouped` está falhando silenciosamente ou retornando vazio.
- A página é lenta porque a RPC reescaneia toda a tabela 3x (CTEs `latest`, `totals`, `grouped`) e faz JOIN com `pedidos` por cast `id::text`, que não usa índice.

## Solução

### 1. Reescrever a RPC `get_confirmacao_grouped` (migration)
- Unificar em uma única passagem: agregar `latest` + `totals` em uma só CTE usando window functions (`row_number() OVER (PARTITION BY gkey, tipo ORDER BY created_at DESC)`).
- JOIN com `pedidos` somente quando `pid_text` é UUID válido, e usar `p.id = g.pid_text::uuid` (sem cast no lado do `pedidos`, permitindo uso de PK).
- Calcular `total_count` apenas uma vez via window `count(*) OVER ()`.
- Retornar resultado mesmo quando o JOIN com `pedidos` falha (manter destinatário do log como fallback).

### 2. Garantir índice de performance
- Confirmar índice em `confirmacao_pagamento_log(loja_id, created_at DESC)` e adicionar índice parcial em `(loja_id, pedido_id)` se necessário.

### 3. Frontend (`src/pages/ConfirmacaoPagamento.tsx`)
- Reduzir `PER_PAGE` para 50 (já está) e garantir que a query não trava em loading infinito quando o RPC retorna erro — mostrar mensagem de erro real.
- Manter debounce de 300ms na busca.

## Resultado esperado
- Histórico carrega em <2s mesmo com 5000+ logs.
- Lista exibe corretamente os ~4899 envios com Enviados/Pendentes/Total batendo com o placar.
