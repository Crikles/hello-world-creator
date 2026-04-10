

## Correção: Vega envia valores em Reais, não centavos

### Problema identificado
A Vega envia `total_price: 48.90` — **já em Reais**. Mas a função `centavosToReais()` divide por 100, transformando R$ 48,90 em R$ 0,489 (que vira R$ 0,49 nos envios).

Evidência no banco:
- `raw_payload.total_price` = `48.90` (Reais)
- `pedidos.total_price` = `49` (deveria ser `4890` centavos)
- `envios.valor` = `0.49` (deveria ser `48.90`)

A mesma lógica afeta os **produtos**: `extractProducts()` usa os valores brutos como centavos, mas eles também já estão em Reais.

### Solução

**Arquivo:** `supabase/functions/webhook-vega/index.ts`

1. **Remover a divisão por 100** no `total_price` — usar o valor bruto diretamente como Reais:
```typescript
const totalPriceReais = Number(String(payload.total_price || 0).replace(/[^0-9.-]/g, "")) || 0;
const totalPriceCentavos = Math.round(totalPriceReais * 100);
```

2. **Corrigir `extractProducts()`** — os valores dos produtos também já estão em Reais, não dividir por 100.

3. **Corrigir recovery products** — remover a divisão `/100` na linha que calcula `value` dos recovery products (linha ~272).

4. **Manter `centavosToReais()` como fallback** mas não usá-la no fluxo principal.

5. **Corrigir envios existentes com valor errado** via migration SQL:
```sql
UPDATE envios e
SET valor = (p.raw_payload->>'total_price')::numeric
FROM pedidos p
WHERE p.envio_id = e.id
  AND p.checkout_provider = 'vega'
  AND e.valor < 1
  AND (p.raw_payload->>'total_price')::numeric > 1;
```

E corrigir os pedidos também:
```sql
UPDATE pedidos
SET total_price = ROUND((raw_payload->>'total_price')::numeric * 100)
WHERE checkout_provider = 'vega'
  AND total_price < 100
  AND (raw_payload->>'total_price')::numeric > 1;
```

### Resultado
- Novos envios Vega com valor correto (R$ 48,90 em vez de R$ 0,49)
- Pedidos existentes corrigidos retroativamente
- Recovery leads com valores corretos

