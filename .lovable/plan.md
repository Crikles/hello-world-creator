

## Corrigir valores dos envios antigos da conta backupativado@gmail.com

### Problema
Existem **65 envios** desde 06/04 com valores errados (centavos em vez de Reais) na loja `75b3b01b-7ec5-440f-81d5-e1c0a4717b57`. Esses envios foram criados pelo webhook Vega antigo que dividia por 100. **Nenhum deles está vinculado a um pedido** (envio_id é NULL nos pedidos).

Distribuição dos valores errados:
- 57 envios com R$ 0,49 → valor real: **R$ 48,90**
- 6 envios com R$ 0,48 → valor real: **R$ 47,90**
- 1 envio com R$ 0,76 → valor real: **R$ 75,60**
- 1 envio com R$ 0,98 → valor real: **R$ 97,80**

### Solução

Executar uma migration SQL com mapeamento direto baseado nos preços conhecidos da loja:

```sql
-- Corrigir envios com valor 0.49 → 48.90
UPDATE envios SET valor = 48.90
WHERE loja_id = '75b3b01b-7ec5-440f-81d5-e1c0a4717b57'
  AND deleted_at IS NULL AND created_at >= '2026-04-06' AND round(valor, 2) = 0.49;

-- Corrigir envios com valor 0.48 → 47.90
UPDATE envios SET valor = 47.90
WHERE loja_id = '75b3b01b-7ec5-440f-81d5-e1c0a4717b57'
  AND deleted_at IS NULL AND created_at >= '2026-04-06' AND round(valor, 2) = 0.48;

-- Corrigir envios com valor 0.76 → 75.60
UPDATE envios SET valor = 75.60
WHERE loja_id = '75b3b01b-7ec5-440f-81d5-e1c0a4717b57'
  AND deleted_at IS NULL AND created_at >= '2026-04-06' AND round(valor, 2) = 0.76;

-- Corrigir envios com valor 0.98 → 97.80
UPDATE envios SET valor = 97.80
WHERE loja_id = '75b3b01b-7ec5-440f-81d5-e1c0a4717b57'
  AND deleted_at IS NULL AND created_at >= '2026-04-06' AND round(valor, 2) = 0.98;
```

Adicionalmente, vincular os 8 pedidos órfãos aos envios correspondentes (por email/nome do cliente) para que apareçam corretamente na aba de Envios com origem e método de pagamento.

### Resultado
- 65 envios corrigidos com valores reais
- Dashboard mostrando faturamento correto
- Gráfico de performance com receita correta

