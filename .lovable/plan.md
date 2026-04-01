

## Plan: Separar Recuperação em "Carrinho Abandonado" e "PIX Pendente"

### Conceito
A página de Recuperação de Vendas terá **duas abas principais** no topo: **Carrinho Abandonado** e **PIX Pendente**. Cada aba terá seu próprio editor de email, webhook URL, configuração independente e lista de leads. O usuário personaliza cada tipo separadamente.

### Alterações

**1. Tabela `recovery_config` — Adicionar coluna `tipo`**
- Nova coluna `tipo` (text, default `'carrinho'`). Valores: `'carrinho'` ou `'pix_pendente'`.
- Cada loja terá até 2 registros: um por tipo.
- Unique constraint em `(loja_id, tipo)`.

**2. Tabela `recovery_leads` — Adicionar coluna `tipo`**
- Nova coluna `tipo` (text, default `'carrinho'`). Identifica se o lead veio do webhook de carrinho ou PIX.

**3. Edge Function `webhook-recovery/index.ts`**
- Aceitar query param `tipo=carrinho` ou `tipo=pix_pendente` (default: `carrinho`).
- Buscar `recovery_config` filtrando por `loja_id` + `tipo`.
- Inserir lead com o `tipo` correto.

**4. Edge Function `send-recovery-email/index.ts`**
- Receber `tipo` no body e buscar a config correspondente.

**5. `src/pages/RecuperacaoVendas.tsx`**
- Tabs de topo: `🛒 Carrinho Abandonado` | `💲 PIX Pendente`.
- Dentro de cada aba: a mesma estrutura atual (sub-tabs Email + Leads, webhook URL, editor com preview).
- Refatorar o editor como componente reutilizável `RecoveryEditor` que recebe `tipo` como prop.
- Cada aba tem webhook URL diferente: `...?token=X&tipo=carrinho` vs `...?token=X&tipo=pix_pendente`.
- Defaults do PIX Pendente ajustados (textos como "Seu PIX está aguardando", "Finalize o pagamento", etc.).

### Webhook URLs resultantes
```
Carrinho: .../webhook-recovery?token=ABC&tipo=carrinho
PIX:      .../webhook-recovery?token=ABC&tipo=pix_pendente
```

### Arquivos alterados
- Nova migration SQL (add `tipo` em `recovery_config` e `recovery_leads`)
- `supabase/functions/webhook-recovery/index.ts`
- `supabase/functions/send-recovery-email/index.ts`
- `src/pages/RecuperacaoVendas.tsx`

