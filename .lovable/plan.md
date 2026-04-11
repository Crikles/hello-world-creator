

## Nova Funcionalidade: Confirmação de Pagamento (Email + SMS)

### Entendimento

Uma nova página no painel onde, ao receber um pedido `paid` via webhook (Zedy, Luna, Vega, etc.), o sistema automaticamente envia:
- **Email de "Pagamento Confirmado"** personalizado com dados da empresa
- **SMS de "Pagamento Confirmado"**

Isso é **separado** do fluxo de Envios/Postagens. O pedido continua sendo criado normalmente nos Envios, mas esse novo módulo dispara notificações instantâneas de confirmação de compra.

**Custos:** 0,50 moedas/email + 0,12 moedas/SMS, debitados via `debit_user_credits`.

### Arquitetura

```text
Webhook (Zedy/Luna/Vega/etc)
  └─ status === "paid"
       ├─ Fluxo atual (cria envio, postagens, etc.)
       └─ [NOVO] Verifica confirmacao_pagamento_config
            ├─ Se ativo + saldo → invoke send-payment-confirmation
            └─ Registra em confirmacao_pagamento_log
```

### Alterações

**1. Banco de Dados (2 novas tabelas + 1 config)**

- **`confirmacao_pagamento_config`** — Configuração por loja
  - `loja_id`, `ativo`, `enviar_email`, `enviar_sms`
  - `assunto_email`, `corpo_email` (template HTML personalizado)
  - `sms_template` (template SMS)
  - RLS: `user_owns_loja`

- **`confirmacao_pagamento_log`** — Log de envios
  - `loja_id`, `pedido_id`, `tipo` (email/sms), `status`, `custo`, `destinatario`
  - RLS: `user_owns_loja` + service_role

- **`system_config`** — Inserir chaves de custo padrão:
  - `custo_confirmacao_email` = 0.50
  - `custo_confirmacao_sms` = 0.12

**2. Nova Edge Function: `send-payment-confirmation`**

- Recebe `pedido_id` e `loja_id`
- Busca config da loja em `confirmacao_pagamento_config`
- Busca dados da empresa em `empresas`
- Monta email personalizado com dados do pedido + empresa
- Usa a **nova chave Resend** (secret a ser adicionada depois) para enviar email
- Envia SMS via IntegraX (mesma integração existente)
- Debita créditos: 0,50 email + 0,12 SMS
- Registra em `confirmacao_pagamento_log`

**3. Modificar Webhooks (Zedy, Luna, Vega, Corvex, Nuvorafy, Shopify, Adoorei)**

No bloco `status === "paid"`, após criar o envio, adicionar fire-and-forget:
```typescript
supabase.functions.invoke("send-payment-confirmation", {
  body: { pedido_id: pedidoId, loja_id: lojaId }
}).catch(e => console.error("[payment-confirmation]", e));
```

**4. Nova Página: `src/pages/ConfirmacaoPagamento.tsx`**

Abas:
- **Configuração** — Ativar/desativar email e SMS, editar templates
- **Histórico** — Tabela com log de confirmações enviadas (status, custo, data)
- **Tutorial** — Explicação do fluxo, custos dinâmicos do DB

**5. Rota + Sidebar**

- Rota: `/loja/:lojaId/confirmacao-pagamento`
- Menu na seção "Operações" com ícone `CreditCard` ou `BadgeCheck`
- Acessível a todos os usuários (sem restrição como Recuperação)

**6. Secret Resend**

A nova chave de API do Resend será adicionada posteriormente pelo usuário. Usaremos o nome `RESEND_CONFIRMATION_API_KEY`.

### Resumo do Fluxo

1. Pedido pago chega via webhook → cria envio normalmente
2. Se `confirmacao_pagamento_config.ativo = true` para a loja:
   - Verifica saldo do dono da loja
   - Envia email de "Compra Aprovada" com dados personalizados da empresa
   - Envia SMS de "Compra Aprovada"
   - Debita 0,50 + 0,12 moedas
3. Tudo registrado no log para auditoria

