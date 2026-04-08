

## Plano: Corrigir dados incompletos da Nuvorafy

### Diagnóstico

O payload REAL da Nuvorafy (`raw_payload` no banco) envia os dados em `payload.data` (não `payload.order`) e inclui **apenas**:
- `customerName`, `customerEmail`, `orderId`, `orderNumber`, `paymentMethod`, `amount`, `status`

**Campos que a documentação promete mas NÃO envia**: `items`, `shipping_address`, `shipping_city`, `shipping_state`, `shipping_zip`, `customer_phone`, `customer_cpf`

Isso causa endereço placeholder na DANFE e produto como "Pedido 260408-..."

### Alterações

**1. `supabase/functions/webhook-nuvorafy/index.ts`** — Corrigir prioridade de extração:

```typescript
// ANTES (não funciona - payload real vem em .data)
const order = payload.order || payload.data || {};

// DEPOIS (priorizar .data que é o formato real)
const order = payload.data || payload.order || {};
```

**2. DANFE / Envio** — Como a Nuvorafy simplesmente não envia endereço nem produtos no payload real, não há como extrair esses dados do webhook. As opções são:

- **Endereço**: O envio será criado sem endereço. O usuário precisará preencher manualmente na tela de envios, ou a Nuvorafy precisa corrigir o payload deles para incluir os campos documentados.
- **Produto**: Manter o fallback "Pedido {orderNumber}" já que não temos o nome real do produto.

**3. Melhorar fallback na DANFE** — Em `src/components/danfe/DanfePreview.tsx`, quando endereço está vazio, mostrar "—" em vez de valores placeholder como "Rua Exemplo, 123" que confundem o usuário.

### Resumo

A Nuvorafy não está enviando os dados que a própria documentação promete. Vamos:
1. Corrigir a prioridade `payload.data` sobre `payload.order`
2. Remover placeholders enganosos da DANFE quando dados estão vazios
3. O nome do produto continuará como "Pedido {número}" até a Nuvorafy incluir `items` no webhook

Recomendação: entrar em contato com o suporte da Nuvorafy para solicitar que enviem `items`, `shipping_*` e `customer_phone`/`customer_cpf` no payload conforme a documentação deles promete.

