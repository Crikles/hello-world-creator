

## Plano: Integração Nuvorafy Checkout

### Análise da documentação

A Nuvorafy envia webhook com `event: "order.paid"` contendo dados completos de cliente, endereço e itens. **Não possui evento de pedido pendente** — apenas `order.paid`. Portanto:
- **Integração (envios)**: evento `order.paid` → cria pedido + envio
- **Recuperação de vendas**: **não disponível** — a API não envia eventos de PIX pendente

### Alterações

**1. Edge Function `supabase/functions/webhook-nuvorafy/index.ts`**

Baseada na estrutura do `webhook-luna`, adaptada para o payload Nuvorafy:
- Autenticação via `?token=` (padrão existente)
- Valida integração ativa na tabela `checkout_integrations` (checkout_id: `nuvorafy`)
- Log em `webhook_logs` com `checkout_provider: "nuvorafy"`
- Mapeia campos do payload:
  - `order.customer_name` → `customer_name`
  - `order.customer_email` → `customer_email`
  - `order.customer_phone` → `customer_phone`
  - `order.customer_cpf` → `customer_document`
  - `order.payment_method` → `method`
  - `order.amount` → `total_price` (× 100 para centavos)
  - `order.items[]` → products
  - `order.shipping_address/city/state/zip` → address fields
- Deduplicação por `order.id` como `transaction_token`
- Cria envio quando `event === "order.paid"` (com filtro de método de pagamento)
- Aplica filtro `filtro_metodo` (todos/cartao/pix)
- Dispara WhatsApp automático

**2. `supabase/config.toml`** — Adicionar:
```toml
[functions.webhook-nuvorafy]
verify_jwt = false
```

**3. `src/pages/Integracoes.tsx`** — Adicionar Nuvorafy ao array `checkouts`:
```typescript
{ id: "nuvorafy", name: "Nuvorafy Checkout", description: "Integração com Nuvorafy Checkout", logo: logoNuvorafy, webhookFn: "webhook-nuvorafy" }
```

**4. Logo** — Buscar/criar um ícone para Nuvorafy em `src/assets/logo-nuvorafy.png`. Se não disponível, usarei um placeholder SVG inline.

### Sobre Recuperação de Vendas

A documentação da Nuvorafy **não inclui eventos de pedido pendente** (como `sale_waiting_payment` da Luna). Apenas `order.paid` é enviado via webhook. Portanto, a recuperação de vendas (PIX pendente) **não será implementada** para este checkout — não há dados disponíveis para isso.

### Resultado esperado
- Nuvorafy aparece como opção na Central de Integrações com toggle, webhook URL e filtro de pagamento
- Pedidos pagos via Nuvorafy criam automaticamente envios no sistema
- `checkout_provider: "nuvorafy"` aparece corretamente na coluna de checkout dos envios

