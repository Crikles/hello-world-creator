

## Filtro de Método de Pagamento por Integração

### Problema
Os webhooks dos checkouts enviam todas as vendas pagas (PIX e cartão juntas). Alguns usuários querem criar envios apenas para vendas de cartão, ignorando PIX.

### Solução
Adicionar um campo `filtro_metodo` na tabela `checkout_integrations` que permite ao usuário escolher quais métodos de pagamento geram envios automaticamente. Os webhooks consultam essa config antes de criar o envio.

### Arquitetura

```text
Webhook recebido → Log salvo (sempre) → Pedido criado (sempre)
                                          ↓
                              Consulta checkout_integrations.filtro_metodo
                                          ↓
                          filtro_metodo = "todos" → cria envio
                          filtro_metodo = "cartao" → só cria se method ≠ pix
                          filtro_metodo = "pix" → só cria se method = pix
```

**Importante**: O webhook SEMPRE loga e cria o pedido. O filtro age apenas na criação do envio (rastreio).

---

### 1. Migration - Novo campo na tabela `checkout_integrations`

```sql
ALTER TABLE public.checkout_integrations 
ADD COLUMN filtro_metodo text NOT NULL DEFAULT 'todos';
```

Valores possíveis: `todos`, `cartao`, `pix`

---

### 2. Atualizar todos os 6 webhooks

Em cada webhook (vega, zedy, luna, corvex, adoorei, shopify), antes de criar o envio:

1. Consultar `checkout_integrations` para obter `filtro_metodo` da loja + checkout
2. Normalizar o valor do `method` do payload (cada checkout usa nomes diferentes para cartão/pix)
3. Aplicar o filtro: se `filtro_metodo = "cartao"` e o método é pix, pular criação do envio (mas manter pedido e log)

Mapeamento de detecção por checkout:
- **Vega**: `payload.method` - valores como `credit_card`, `pix`, `boleto`
- **Zedy**: `payload.paymentMethod` - valores como `credit_card`, `pix`
- **Luna**: `payload.method` - valores como `credit_card`, `pix`
- **Corvex**: `payload.method` - valores como `credit_card`, `pix`
- **Adoorei**: `resource.payment_method` - valores como `credit_card`, `pix`

A lógica de detecção será simples: se o valor do method contém "pix" (case-insensitive), é PIX. Caso contrário, é cartão.

---

### 3. UI - Página de Integrações

Adicionar um seletor abaixo do toggle de cada checkout card com 3 opções:

- **Todas as vendas** (default) - recebe PIX + cartão
- **Apenas Cartão** - ignora vendas de PIX
- **Apenas PIX** - ignora vendas de cartão

Visível apenas quando a integração está ativa. Usa o mesmo mutation pattern de `toggleCheckoutMutation` para salvar no `checkout_integrations`.

---

### Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | Adicionar coluna `filtro_metodo` |
| `src/pages/Integracoes.tsx` | Seletor de filtro no card de cada checkout |
| `supabase/functions/webhook-vega/index.ts` | Consultar filtro antes de criar envio |
| `supabase/functions/webhook-zedy/index.ts` | Idem |
| `supabase/functions/webhook-luna/index.ts` | Idem |
| `supabase/functions/webhook-corvex/index.ts` | Idem |
| `supabase/functions/webhook-adoorei/index.ts` | Idem |
| `supabase/functions/shopify-webhook/index.ts` | Idem |

