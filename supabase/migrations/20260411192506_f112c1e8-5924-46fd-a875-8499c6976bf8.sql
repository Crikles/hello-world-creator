UPDATE envios SET valor = valor / 100 WHERE id IN (
  SELECT e.id FROM envios e JOIN pedidos p ON p.envio_id = e.id 
  WHERE p.checkout_provider = 'vega'
);
UPDATE pedidos SET total_price = total_price / 100 WHERE checkout_provider = 'vega' AND total_price > 100;