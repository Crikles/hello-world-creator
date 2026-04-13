

## Plano: Ajustar integração Nuvorafy conforme documentação atualizada

### Gaps identificados

| Campo | Situação atual | Correção |
|-------|---------------|----------|
| `items[].price` | Ignorado (amount=0) | Capturar e converter para centavos |
| `cart.abandoned` → `id` | Já tem fallback, mas `cart_number` não é usado como `order_number` prioritário | Priorizar `cart_number` para cart.abandoned |
| `checkout_link` para order.pending | Já captura, mas precisa garantir que seja salvo no recovery lead | OK, já funciona |
| `shipping_cost` / `discount_amount` | Não capturados | Armazenar no `raw_payload` (já salvo), não precisa de campo extra |
| `abandoned_step` | Não capturado | Salvar no `raw_payload` do recovery lead (já acontece) |

### Alterações em `supabase/functions/webhook-nuvorafy/index.ts`

**1. Capturar preço dos itens nos produtos normalizados**
- Atualmente `amount: 0` — mudar para usar `item.price` convertido em centavos
- Isso melhora a exibição de produtos nos emails de recuperação e nos envios

**2. Para `cart.abandoned`, ajustar o `transactionToken`**
- Usar `order.id` (campo principal no cart.abandoned) como token, já que não tem `order_id`
- Usar `order.cart_number` como `orderNumber`

**3. Garantir que `total_amount` (cart.abandoned) funcione corretamente**
- Já tem fallback `order.total_amount` — confirmar que está sendo usado

**4. Melhorar os produtos de recovery para incluir valor individual**
- Atualmente `recoveryProducts` tem `value: 0` — usar o preço do item quando disponível

### Arquivos alterados
- `supabase/functions/webhook-nuvorafy/index.ts` — ajustes nos pontos acima

### Impacto
- Pedidos (order.paid): preços individuais dos itens serão armazenados corretamente
- Recuperação (order.pending / cart.abandoned): leads terão valores de produtos preenchidos, melhorando emails de recuperação
- Sem breaking changes — apenas enriquecimento de dados

