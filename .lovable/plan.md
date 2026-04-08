

## Plano: Adicionar Recuperação de Vendas para Nuvorafy (status `processing` = pendente)

### Contexto

A Nuvorafy possui o status `processing` que equivale a um pedido pendente (PIX aguardando pagamento). Embora a documentação do webhook só mencione `order.paid`, o status `processing` na API de listagem indica que a plataforma reconhece pedidos pendentes. Vamos tratar qualquer webhook com `order.status === "processing"` como trigger de recuperação.

### Alterações

**1. `supabase/functions/webhook-nuvorafy/index.ts`** — Adicionar bloco de recuperação (após o upsert em pedidos, antes da criação de envio):

- Detectar se `order.status === "processing"` e `method === "pix"` como PIX pendente
- Verificar `recovery_config` ativo para `pix_pendente`
- Deduplicar por `transaction_token` na tabela `recovery_leads`
- Inserir lead com dados do cliente, produtos e `checkout_url` (se disponível no payload)
- Disparar fire-and-forget `send-recovery-email` e `send-recovery-sms`
- Proteger com try-catch isolado para não impactar o fluxo principal
- Quando `order.paid` chega depois, o pedido já existe (deduplicação) e segue o fluxo normal de envio

**2. `src/pages/RecuperacaoVendas.tsx`** — Atualizar a linha da Nuvorafy na tabela de checkouts:

```typescript
// De:
{ name: "Nuvorafy", qrcode: false, copiaECola: false, urlCheckout: false }
// Para:
{ name: "Nuvorafy", qrcode: false, copiaECola: false, urlCheckout: true }
```

A Nuvorafy não envia QR Code nem Copia e Cola no payload, mas pode ter `checkout_url` no order, então marcamos `urlCheckout: true`.

### Resultado esperado
- Pedidos Nuvorafy com status `processing` + método PIX criam leads de recuperação automaticamente
- E-mail e SMS de recuperação são disparados
- Quando o `order.paid` chega, o envio é criado normalmente (sem duplicar lead)
- Tabela de compatibilidade atualizada na página de Recuperação

