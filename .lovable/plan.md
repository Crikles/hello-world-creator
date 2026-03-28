

## Plan: Webhooks de notificação de recarga PIX

### Alterações

**1. Tabela `admin_payment_webhooks`** — Nova migration para armazenar URLs de webhook configuradas pelo admin.
- Colunas: `id`, `url` (text), `label` (text opcional), `ativo` (boolean, default true), `created_at`
- RLS: apenas admins (has_role admin)

**2. `src/pages/admin/AdminPagamentos.tsx`** — Adicionar seção "Webhooks" abaixo da tabela de pagamentos.
- CRUD de webhooks: listar URLs cadastradas, input para adicionar nova URL, botão remover
- Toggle ativo/inativo por webhook
- Busca e mutação via react-query + supabase

**3. `supabase/functions/webhook-woovi/index.ts`** — Após processar pagamento com sucesso (após linha 224), disparar POST para todas as URLs ativas na tabela `admin_payment_webhooks`.
- Payload: nome do usuário, email, valor em reais, moedas, data
- Fire-and-forget (não bloqueia resposta do webhook principal)

**4. Seed inicial** — Inserir as 2 URLs do PushCut via migration INSERT:
- `https://api.pushcut.io/cnofVRbcHtpDYX8uuBjpi/notifications/Recarga%20Magnus`
- `https://api.pushcut.io/nvQPVRoZkrDRY_bb1oBXq/notifications/MinhaNotifica%C3%A7%C3%A3o1`

### Payload enviado aos webhooks
```json
{
  "evento": "recarga_pix",
  "usuario": "Nome",
  "email": "email@...",
  "valor": "R$ 50,00",
  "moedas": 100,
  "data": "2026-03-28T..."
}
```

### Arquivos alterados
- Nova migration SQL (tabela + seed)
- `src/pages/admin/AdminPagamentos.tsx`
- `supabase/functions/webhook-woovi/index.ts`

