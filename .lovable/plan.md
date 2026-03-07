

# Corrigir produtos dos pedidos antigos (backfill)

## Situacao

Os dados **nao foram perdidos**. A tabela `pedidos` tem o campo `products` (JSONB) com a lista completa de todos os produtos de cada pedido. O problema e que o campo `envios.produto` recebeu apenas o primeiro item. Podemos corrigir isso retroativamente.

## Solucao

Criar uma **migration SQL** que faz o backfill: para cada `envio` que tem um `pedido` vinculado com mais de 1 produto, atualizar o campo `envios.produto` com o JSON completo e `envios.quantidade` com a soma total.

### SQL da migration:

```sql
UPDATE envios e
SET 
  produto = (
    SELECT jsonb_agg(
      jsonb_build_object(
        'nome', COALESCE(p_item->>'title', p_item->>'name', 'Produto'),
        'quantidade', COALESCE((p_item->>'quantity')::int, 1)
      )
    )::text
    FROM pedidos ped,
         jsonb_array_elements(ped.products) AS p_item
    WHERE ped.envio_id = e.id
  ),
  quantidade = (
    SELECT COALESCE(SUM(COALESCE((p_item->>'quantity')::int, 1)), e.quantidade)
    FROM pedidos ped,
         jsonb_array_elements(ped.products) AS p_item
    WHERE ped.envio_id = e.id
  )
WHERE EXISTS (
  SELECT 1 FROM pedidos ped
  WHERE ped.envio_id = e.id
    AND jsonb_array_length(ped.products) > 1
);
```

### O que isso faz:
- Encontra todos os envios vinculados a pedidos com 2+ produtos
- Reconstroi o campo `produto` no formato JSON `[{ nome, quantidade }]` que o frontend ja suporta
- Atualiza `quantidade` com a soma total de itens
- Nao altera envios que tem apenas 1 produto (continuam funcionando)
- Nao altera envios sem pedido vinculado (criados manualmente)

### Arquivo modificado:
- Nova migration SQL via ferramenta de migracao

### Impacto:
- Zero downtime
- Pedidos antigos com multiplos produtos passam a exibir todos os itens imediatamente
- Nenhuma mudanca no frontend necessaria

