

## Plan: Integrar Adoorei com Recuperação de Vendas (Carrinho Abandonado + PIX Pendente)

### Análise da Documentação Adoorei

**Mapeamento de eventos:**
- **Carrinho Abandonado** → `event: "cart.abandoned"` — payload diferente do pedido, com `resource.checkout_url`, `resource.customer.name`, `resource.products[]`
- **PIX Pendente** → `event: "order.created"` ou `"order.status.updated"` com `status: "pending"` e `payment_method: "pix"`

### Alteração: `supabase/functions/webhook-adoorei/index.ts`

Dois pontos de inserção da lógica de recuperação:

**1. Carrinho Abandonado (`cart.abandoned`)**
- O payload de carrinho é estruturalmente diferente (não tem `resource.status`, `resource.number`, etc.)
- Detectar `event === "cart.abandoned"` logo após o log do webhook (linha ~82)
- Extrair dados do formato de carrinho:
  - `customer_name` = `resource.customer.name`
  - `customer_email` = `resource.customer.email`
  - `customer_phone` = `resource.customer.phone_number`
  - `checkout_url` = `resource.checkout_url`
  - `total_value` = `resource.total` (já em reais)
  - Produtos: `resource.products[].name` → name, `resource.products[].price` → value, `resource.products[].qty` → qty
- Tipo = `"carrinho"`
- Após inserir o lead, fazer `return` (não processar como pedido normal)

**2. PIX Pendente (pedido com status pending + pix)**
- Após o upsert do pedido (linha ~149) e antes do bloco "If approved" (linha ~152):
  - Se `status === "pending"` e `payment_method` inclui `"pix"`:
    - Tipo = `"pix_pendente"`
    - `checkout_url` = `""` (Adoorei não fornece URL de recuperação no payload de pedido)
    - Normalizar produtos do formato já existente
    - `total_value` = `totalPriceInCents / 100`

**Ambos os casos seguem o padrão já implementado:**
- Verificar `recovery_config` ativo para loja + tipo
- Deduplicação 24h em `recovery_leads` por email + loja + tipo
- Inserir em `recovery_leads`
- Fire-and-forget: `send-recovery-email` e `send-recovery-sms`

### Detalhes técnicos

- Carrinho abandonado tem estrutura diferente: `customer.name` (não `first_name`/`last_name`), `customer.phone_number` (não `phone`)
- `resource.total` no carrinho = valor em reais
- `resource.value_total` no pedido = valor em reais
- O bloco de carrinho abandonado deve ser tratado antes do upsert de pedido (early return)

### Arquivo alterado
- `supabase/functions/webhook-adoorei/index.ts` (apenas)
- Redeploy da edge function

