

## Plano: Assinatura mensal de instância WhatsApp (29,99 moedas)

### Modelo

- Cada instância WhatsApp custa **29,99 moedas/mês** (configurável via `system_config`)
- Ao criar instância: debita 29,99 moedas e define `expires_at = now() + 30 dias`
- Ao expirar: instância permanece conectada, mas **envios são bloqueados** até renovação
- Renovar: debita 29,99 novamente e estende `expires_at` por +30 dias
- Exclusão não reembolsa moedas

### Alterações

#### 1. Database Migration
- Adicionar colunas em `whatsapp_instances`:
  - `expires_at TIMESTAMPTZ` — data de expiração da assinatura
  - `subscription_price NUMERIC DEFAULT 29.99` — preço pago na criação
- Inserir registro na `system_config`:
  - `key: 'custo_whatsapp'`, `value: 29.99`, `label: 'Assinatura WhatsApp (moedas/mês)'`

#### 2. Edge Function `send-whatsapp`
- **Action `init`**: antes de criar a instância, buscar preço de `system_config`, chamar `debit_user_credits` para debitar. Se saldo insuficiente, retornar erro. Salvar `expires_at` e `subscription_price` no registro.
- **Action `send` e `send-text`**: verificar se `expires_at > now()`. Se expirado, retornar erro `"Assinatura expirada"`.
- **Nova action `renew`**: debitar moedas novamente e estender `expires_at` por +30 dias a partir da data atual (ou da expiração se ainda no futuro).

#### 3. Frontend `src/pages/WhatsApp.tsx`
- Buscar saldo de moedas do usuário para exibir
- Na tela de "criar instância": mostrar preço e saldo disponível, desabilitar se saldo < preço
- Quando instância existe: mostrar status da assinatura (dias restantes, expirada)
- Botão "Renovar Assinatura" quando faltam poucos dias ou já expirou
- Na aba "Enviar": bloquear envio se assinatura expirada, exibir banner de renovação
- Ao excluir instância: confirmar que moedas não serão reembolsadas

#### 4. Admin (`AdminValores.tsx`)
- Adicionar campo `custo_whatsapp` na lista de configurações editáveis (se já usa `system_config` dinâmico, aparece automaticamente)

### Arquivos alterados
- `supabase/functions/send-whatsapp/index.ts` — debitar moedas, verificar expiração, ação renew
- `src/pages/WhatsApp.tsx` — UI de assinatura, saldo, renovação, bloqueio
- Migration SQL — colunas `expires_at`, `subscription_price` + registro `system_config`

