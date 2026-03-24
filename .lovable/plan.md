

## Indicador Visual de Origem do Envio (Webhook vs Manual)

### Problema
Atualmente na pagina de Envios nao ha como saber se um envio foi criado automaticamente por um webhook de checkout ou manualmente pelo usuario.

### Abordagem
A tabela `pedidos` ja possui o campo `envio_id` que referencia o envio criado pelo webhook, alem do campo `checkout_provider` indicando a origem. Basta fazer um JOIN ou query complementar para identificar quais envios possuem um pedido vinculado.

### Implementacao

**Arquivo: `src/pages/Envios.tsx`**

1. Apos buscar os envios, fazer uma query complementar na tabela `pedidos` para obter os `envio_id` e `checkout_provider` dos pedidos vinculados a loja
2. Criar um Map de `envio_id -> checkout_provider` para lookup rapido
3. Adicionar uma Badge compacta ao lado da badge de transportadora (JL/JADLOG) em cada linha:
   - Se o envio tem pedido vinculado: Badge com icone Zap + nome do checkout (ex: "Vega", "Corvex", "API") em cor primaria
   - Se nao tem pedido vinculado: Badge "Manual" em cor neutra

### UI do Badge

```text
[JL] [⚡ Vega]     ← envio criado via webhook Vega
[JADLOG] [Manual]   ← envio criado manualmente
[JL] [⚡ API]       ← envio criado via API externa
```

Sera uma badge pequena (text-[8px]) consistente com as badges existentes de transportadora.

### Detalhes Tecnicos

- Query: `supabase.from("pedidos").select("envio_id, checkout_provider").eq("loja_id", loja.id).not("envio_id", "is", null)`
- Mapeamento de nomes: `vega` -> "Vega", `zedy` -> "Zedy", `api_externa` -> "API", etc.
- A query sera feita em paralelo com a query de envios usando um `useQuery` separado
- Nenhuma mudanca no banco de dados necessaria

