

## Exibir Método de Pagamento (PIX / Cartão) nos Envios

### Situacao Atual
A query que busca a origem do envio ja consulta a tabela `pedidos` buscando `envio_id` e `checkout_provider`. O campo `method` da tabela `pedidos` armazena o metodo de pagamento (ex: "pix", "credit_card", "cartao", etc.) e ja esta preenchido para vendas historicas vindas dos webhooks.

### Plano

**Arquivo: `src/pages/Envios.tsx`**

1. Alterar a query existente de `pedido-origem` para tambem buscar o campo `method`:
   - `.select("envio_id, checkout_provider, method")`
   
2. Criar um segundo Map `pedidoMetodoMap` de `envio_id -> method` para lookup do metodo de pagamento

3. Adicionar uma Badge compacta ao lado da badge de origem, mostrando:
   - Se method contem "pix" → Badge "PIX" com cor verde/esmeralda
   - Se method contem "card"/"cartao"/"credit" → Badge "Cartão" com cor azul
   - Se method existe mas nao reconhecido → Badge com o valor original
   - Se nao tem pedido vinculado (manual) → nao exibir badge de metodo

### Visual (referencia da screenshot do usuario)

```text
[Em Transito] [JADLOG] [⚡ Corvex] [PIX]      ← verde
[Em Transito] [JADLOG] [⚡ API]    [Cartão]   ← azul
[Postado]     [JL]     [Manual]               ← sem badge de metodo
```

### Notas
- Funciona para vendas historicas pois o campo `method` ja foi salvo nos webhooks
- Envios manuais (sem pedido vinculado) nao terao badge de metodo
- Nenhuma mudanca no banco de dados necessaria

