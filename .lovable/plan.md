

## Bug: Recarga PIX disparou avanço em massa de envios

### Causa raiz
O fluxo `check-pix-payment` → `retry-failed-sends` contém uma operação destrutiva no final do processamento:

```ts
// supabase/functions/retry-failed-sends/index.ts (linhas 240-245 e 366-369)
.from("envios")
.update({ proximo_avanco_em: NOW() })
.in("loja_id", lojaIds)
.lte("proximo_avanco_em", NOW())   // ← pega TODOS envios "atrasados"
.is("deleted_at", null);
```

Esse `UPDATE` reseta o `proximo_avanco_em` de **todos os envios da loja** que tinham agendamento no passado (incluindo envios antigos parados, em pausa, ou em ritmo natural). Em seguida força `advance-shipments`, que processa todos eles em rajada cobrando 1 moeda cada.

### Evidências do caso (rodrigo junior, loja yaveh)
- **Recarga PIX**: 01:04:08 → +110 moedas
- **01:04 → 01:06** (3 minutos): **110 consumos** "Envio processado (E-mail, Falha na Entrega)"
- **Saldo final**: 0,6 moedas (perdeu praticamente toda a recarga)
- 895 envios da loja foram tocados (`updated_at`) na mesma janela
- O propósito original do `retry-failed-sends` é apenas **reprocessar disparos que falharam por saldo insuficiente** — ele NÃO deveria mexer em envios saudáveis

### Correção (em modo padrão, com aprovação)

**1. Remover o UPDATE em massa do `retry-failed-sends`** (2 ocorrências: linhas ~240 e ~366):
- Remover completamente o bloco que faz `.update({ proximo_avanco_em: NOW() })`
- O `retry-failed-sends` deve apenas reprocessar a fila de **falhas** (`confirmacao_pagamento_log` status=failed e `whatsapp_send_queue` status=failed) — exatamente o que o nome diz
- A chamada subsequente a `advance-shipments` pode permanecer (sem o body destrutivo), pois o cron já roda a cada 5 min e processa apenas envios com `proximo_avanco_em <= now()` que **naturalmente** chegaram a esse ponto

**2. Reembolso ao usuário**
- Restaurar 110 moedas para `rodrigosantosderesendejunior@gmail.com` (saldo atual 0,6 → 110,6)
- Registrar transação `tipo='ajuste'` com descrição: "Reembolso — bug de avanço em massa após recarga PIX (23/04)"

**3. Auditoria preventiva**
- Buscar nos últimos 30 dias outras lojas com padrão semelhante (recarga PIX seguida de >20 consumos em <5 min) e listar para o usuário decidir reembolsos adicionais

### Arquivos afetados
- `supabase/functions/retry-failed-sends/index.ts` (remover 2 blocos de UPDATE em massa)

### Garantia de não-recorrência
Após a correção, o `retry-failed-sends` fica restrito ao seu escopo: **somente** reprocessar pedidos que estavam na fila de falhas por saldo insuficiente (rastreados em `confirmacao_pagamento_log`/`whatsapp_send_queue`). Envios saudáveis seguem o cronograma normal de `proximo_avanco_em` definido pelo template, sem interferência da recarga.

