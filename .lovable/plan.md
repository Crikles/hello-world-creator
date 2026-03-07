

## Plano: Slots de assinatura WhatsApp

### Problema atual
Ao deletar uma instância, o usuário perde a assinatura paga. Ele deveria poder criar uma nova instância sem pagar novamente, desde que o período da assinatura ainda esteja ativo.

### Solução: Tabela `whatsapp_subscriptions`

Separar o conceito de **assinatura (slot pago)** da **instância (conexão UAZAPI)**. Cada slot pago permite criar/deletar instâncias livremente até expirar.

### Alterações

#### 1. Database Migration
- Criar tabela `whatsapp_subscriptions`:
  - `id`, `loja_id`, `user_id`, `expires_at`, `price_paid`, `created_at`
  - RLS: `user_owns_loja` para acesso
- As colunas `expires_at` e `subscription_price` em `whatsapp_instances` continuam existindo mas serão preenchidas a partir da subscription

#### 2. Edge Function `send-whatsapp`
- **Action `init`**:
  - Antes de cobrar, verificar se existe um slot livre (subscription sem instância vinculada e com `expires_at > now()`)
  - Se existe slot livre: criar instância sem cobrar, vinculando ao slot
  - Se não existe: cobrar moedas e criar nova subscription + instância
- **Action `delete`**:
  - Deletar a instância mas **manter** a subscription ativa
  - Assim o slot fica "livre" para nova instância
- **Action `renew`**: renovar a subscription (não a instância)
- Adicionar coluna `subscription_id` em `whatsapp_instances` para vincular

#### 3. Frontend `src/pages/WhatsApp.tsx`
- Ao criar instância: mostrar "Slot disponível — criar sem custo" quando há subscription ativa sem instância
- Ao deletar: confirmar que a assinatura permanece ativa e ele pode criar nova instância
- Mostrar quantos slots ativos o usuário tem vs quantas instâncias existem
- Botão "Nova Instância" com label diferente quando há slot livre ("Usar Slot") vs pago ("Nova Instância — {price} moedas")

### Arquivos alterados
- `supabase/functions/send-whatsapp/index.ts` — lógica de slots
- `src/pages/WhatsApp.tsx` — UI de slots
- Migration SQL — tabela `whatsapp_subscriptions`, coluna `subscription_id` em `whatsapp_instances`

