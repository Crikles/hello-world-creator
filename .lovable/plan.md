

## Plano: Webhook Resend + Painel de Saúde de Email por Usuário

### Resumo

Integrar webhooks da Resend para capturar status reais dos emails (delivered, bounced, complained, etc.) e criar um painel admin focado em **problemas por usuário** — mostrando quais contas têm emails com status negativos e em qual etapa do pedido ocorreram.

### Entendi sua ideia — aqui está a versão aperfeiçoada:

Em vez de mostrar todos os emails de todos os usuários (que seria poluído), o painel vai funcionar assim:

1. **Visão geral**: Cards com totais de bounces, complaints e falhas no período
2. **Ranking de usuários problemáticos**: Uma tabela mostrando cada usuário que teve pelo menos 1 status negativo, com:
   - Nome / Email do usuário
   - Nome da loja
   - Quantidade de bounces, complaints e falhas
   - % de falha (negativos / total enviados)
3. **Drill-down por usuário**: Ao clicar num usuário, expande e mostra quais **etapas do fluxo** (ex: "Saiu para Entrega", "Falha Entrega", "Entregue") geraram os status negativos, com contagem por etapa
4. Tudo isso **apenas no painel admin**

### Alterações técnicas

**1. Migration: Adicionar colunas na `postagem_email_log`**
- `resend_email_id TEXT` — vincula ao ID do Resend para receber webhooks
- `updated_at TIMESTAMPTZ DEFAULT now()` — última atualização de status

**2. Edge Function: `send-email/index.ts`**
- Salvar `resendData.id` como `resend_email_id` nos inserts de log (linhas 1250-1258)

**3. Nova Edge Function: `webhook-resend/index.ts`**
- Recebe POST da Resend com eventos (delivered, opened, bounced, complained, delivery_delayed)
- Localiza o log pelo `resend_email_id` (campo `data.email_id` do payload)
- Atualiza o `status` e `updated_at` do registro
- Valida via header Svix (opcional, pode ser adicionado depois com signing secret)
- Status mapeados: `email.delivered` → `delivered`, `email.bounced` → `bounced`, `email.complained` → `complained`, `email.delivery_delayed` → `delivery_delayed`

**4. Nova página admin: Saúde de Email por Usuário**
- Rota: `/admin/email-saude`
- Query que cruza `postagem_email_log` → `envios` → `lojas` → `profiles` para agrupar por usuário
- Cruza com `postagem_eventos` (via `evento_id`) para saber o nome da etapa
- Filtra apenas status negativos: `bounced`, `complained`, `failed`, `delivery_delayed`
- Cards resumo no topo + tabela de usuários com accordion para drill-down por etapa
- Filtro por período (7d, 30d, custom)

**5. Atualizar `AdminEmail.tsx` existente**
- Mostrar badges coloridas para os novos status (delivered=verde, bounced=vermelho, complained=laranja)
- O painel existente continua sendo o log geral

**6. Adicionar rota e link no menu admin**
- Nova entrada no sidebar: "Saúde Emails"
- Rota protegida com `AdminRoute`

