UPDATE envios SET quantidade = 1 WHERE id IN (
  SELECT e.id FROM envios e JOIN pedidos p ON p.envio_id = e.id 
  WHERE p.checkout_provider = 'vega' AND e.quantidade > 10
);