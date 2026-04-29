## Problema confirmado (conta backupativado@gmail.com)

Após o saldo zerar (15:25:30), **9 pedidos da loja "Variedades" foram processados e marcados como "em_transito" SEM nenhum débito de moedas registrado**. Saldo atual = 0.08, e zero transações de consumo registradas após o saldo bater fundo.

## Causa raiz (BUG no servidor)

Arquivo: `supabase/functions/advance-shipments/index.ts` (linhas 840–903)

A função do cron faz o avanço do envio com **Optimistic Lock primeiro**, e só depois tenta debitar. Quando o débito falha por saldo insuficiente:

```ts
// Linha 893-899
console.warn(`Insufficient balance ... envio ${envioId} avançou sem débito (saldo zerou em corrida).`);
supabase.functions.invoke("low-balance-alert", ...);
// Não revertemos o avanço — mas paramos o envio aqui para não enviar e-mail sem cobrar.
return false;
```

O comentário "não enviamos e-mail" está correto, MAS o envio fica permanentemente em `ultimo_evento_ordem=1` (em_transito). Como o `auto_envio` está ativo, novos pedidos chegando entram nesse mesmo fluxo: cron pega → faz UPDATE → tenta debitar → falha → mantém avançado de graça.

Observação: o caminho client-side (`src/lib/email-trigger.ts`) está correto — debita ANTES de avançar e lança `InsufficientBalanceError` se faltar saldo. O bug é exclusivo do cron.

## Estratégia de correção

### 1. Corrigir o cron `advance-shipments` (débito ANTES do avanço)

Inverter a ordem: primeiro tentar debitar, só se OK fazer o UPDATE com optimistic lock. Assim:
- Se saldo insuficiente → envio fica pendente (`ultimo_evento_ordem=0`), próxima execução do cron tenta de novo (e o cron já pula stores sem saldo via low-balance-alert throttle).
- Se outro processo já avançou (lock falha) → reverter o débito (creditar de volta) para evitar dupla cobrança.

Pseudo-código:
```ts
if (currentOrdem === 0 && total > 0) {
  const { data: debitOk } = await supabase.rpc("debit_user_credits", {...});
  if (!debitOk) {
    // dispara alerta, mantém envio pendente, não avança
    return false;
  }
}

const { data: updatedRows } = await supabase.from("envios").update({...})
  .eq("id", envioId).eq("ultimo_evento_ordem", currentOrdem).select("id");

if (!updatedRows?.length) {
  // Outro processo avançou: estornar débito
  if (debitado) await supabase.from("creditos").update({ saldo: saldo + total })...
  return false;
}
```

Para tornar o estorno seguro e atômico, criar RPC `refund_user_credits(_user_id, _quantidade, _descricao)` que faz o inverso de `debit_user_credits` (FOR UPDATE + UPDATE + INSERT em creditos_transacoes com tipo='estorno').

### 2. Compensar a conta backupativado@gmail.com

Os 9 envios já foram processados (em_transito) sem cobrança. Como saldo já zerou, marcar isso como dívida não faz sentido. Duas opções para o ressarcimento ao sistema:
- **(a) Não cobrar** — assumir o prejuízo (9 moedas) e seguir.
- **(b) Reverter os 9 envios para "pendente"** (ultimo_evento_ordem=0) — assim quando o usuário recarregar, o cron processa normalmente cobrando. Nenhum email foi enviado para esses 9 (o `return false` parou antes do envio), então é seguro reverter.

Recomendo **(b)** — é o estado correto: pedidos chegaram, mas como não havia saldo, devem ficar pendentes aguardando recarga.

### 3. Auditoria global

Rodar uma query buscando outros casos do mesmo bug (envios em_transito após data X com proprietário sem transação de débito correspondente) e aplicar mesmo tratamento de reversão para "pendente".

## Arquivos alterados

- **`supabase/functions/advance-shipments/index.ts`** — inverter ordem débito↔avanço, adicionar estorno em caso de race no lock.
- **Nova migração** — criar RPC `refund_user_credits`.
- **Operação de dados (insert tool)** — reverter os 9 envios do backupativado para `ultimo_evento_ordem=0, status='pendente', proximo_avanco_em=NULL`. Auditar e reverter casos análogos em outras lojas.

## Riscos

- O cron rodará a cada 5 min e tentará novamente os pendentes — se a loja tem `auto_envio=true` e saldo zero, vai disparar o alerta repetidamente. O `low-balance-alert` já tem throttle de 24h, então só o primeiro envio dispara notificação. Os demais apenas falham silenciosamente, comportamento desejado.
- Estorno via RPC é seguro porque usa `FOR UPDATE` no saldo.
