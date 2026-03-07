

# Otimizar advance-shipments para alta escala

## Problemas Identificados

O cron atual tem um limite de **50 envios por execução** (`MAX_PER_RUN = 50`). Rodando a cada 5 minutos, isso significa no maximo **600 envios/hora**. Com 1000+ pedidos/dia e cada pedido tendo ~8 etapas, seriam ~8000 avanços/dia necessarios. O sistema atual nao da conta.

Alem disso, o processamento e **sequencial** — cada envio faz ~5-10 queries ao banco antes de passar pro proximo. Uma loja com muitos pedidos pode bloquear as outras.

## Solucao

### 1. Aumentar `MAX_PER_RUN` de 50 para 200

Isso permite processar ate 2400 envios/hora (200 x 12 execucoes por hora), suficiente para o volume atual e proximo crescimento.

### 2. Processar envios em paralelo (batches de 10)

Em vez de processar um envio por vez (`for...of` sequencial), agrupar em lotes de 10 e executar com `Promise.allSettled`. Isso reduz o tempo total de execucao drasticamente.

### 3. Garantir fairness entre lojas

Limitar cada loja a no maximo `MAX_PER_RUN / 2` envios por execucao, garantindo que uma loja com muitos pedidos nao bloqueie as demais.

## Arquivo Modificado

- `supabase/functions/advance-shipments/index.ts`

### Mudancas especificas:

```text
Linha 319: MAX_PER_RUN = 50 → MAX_PER_RUN = 200
Linha ~337: Adicionar MAX_PER_LOJA = 100

Linhas 402-410 (auto-start loop):
  Agrupar pending em batches de 10
  Processar cada batch com Promise.allSettled

Linhas 427-435 (advance loop):
  Mesmo pattern de batches de 10
  
Ambos loops: respeitar MAX_PER_LOJA por iteracao de loja
```

### Estrutura do batch processing:

```typescript
const BATCH_SIZE = 10;
for (let i = 0; i < items.length; i += BATCH_SIZE) {
  const batch = items.slice(i, i + BATCH_SIZE);
  const results = await Promise.allSettled(
    batch.map(item => advanceShipment(...))
  );
  totalProcessed += results.filter(r => r.status === 'fulfilled' && r.value).length;
}
```

## Resultado Esperado

- Capacidade: de 600/hora para 2400+/hora
- Latencia: cada execucao do cron sera ~5x mais rapida com paralelismo
- Fairness: nenhuma loja monopoliza o processamento
- Nenhum pedido atrasa no fluxo

