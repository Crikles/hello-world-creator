

## Plan: Sistema de Recuperação de Vendas (Carrinho Abandonado)

Este é um recurso completo e grande. Vou dividir em fases para garantir qualidade.

### Visão Geral

Cada loja terá uma **URL de webhook dedicada para vendas pendentes** que o usuário configura no checkout. Quando um lead abandona o carrinho, o webhook recebe os dados e dispara automaticamente um **email de recuperação personalizado** (e opcionalmente SMS) com copy customizável, suporte a cupom condicional e variáveis dinâmicas extraídas do payload.

### Alterações

**1. Tabela `recovery_config` (por loja)** — Armazena a configuração de recuperação de cada loja.
- `loja_id`, `ativo` (boolean), `delay_minutos` (tempo antes de disparar, default 30)
- `assunto_email` (template do subject)
- `corpo_email` (HTML do email com variáveis Mustache)
- `enviar_sms` (boolean), `sms_template` (texto do SMS)
- `cupom_ativo` (boolean), `codigo_cupom`, `descricao_cupom`
- `beneficio_principal`, `beneficio_1`, `beneficio_2`, `beneficio_3`
- `garantia`, `ps_reforco_urgencia`
- RLS: `user_owns_loja`

**2. Tabela `recovery_leads` — Leads pendentes capturados pelo webhook.**
- `loja_id`, `customer_name`, `customer_email`, `customer_phone`
- `products` (jsonb — nome, valor, quantidade, imagem)
- `total_value`, `checkout_url`, `raw_payload` (jsonb)
- `status` (pendente / email_enviado / sms_enviado / convertido / expirado)
- `email_sent_at`, `sms_sent_at`, `created_at`
- RLS: `user_owns_loja`

**3. Edge Function `webhook-recovery/index.ts`** — Nova função para receber eventos de venda pendente/carrinho abandonado.
- Aceita POST com `?token=` (mesmo padrão dos outros webhooks)
- Normaliza payload de qualquer checkout (Vega, Zedy, Luna, Corvex, Adoorei, API Externa)
- Extrai: nome, email, telefone, produtos (nome, valor, qty), total, checkout_url
- Salva em `recovery_leads` com status `pendente`
- Opcionalmente dispara email/SMS imediatamente ou agenda (baseado no `delay_minutos`)

**4. Edge Function `send-recovery-email/index.ts`** — Processa e envia o email de recuperação.
- Busca `recovery_config` da loja
- Substitui variáveis no template: `{{nome_cliente}}`, `{{lista_produtos}}`, `{{valor_total}}`, `{{link_checkout}}`, `{{beneficio_principal}}`, etc.
- Suporte a condicionais Mustache `{{#existe_cupom}}...{{/existe_cupom}}`
- Envia via Resend (mesma infra existente)
- Debita moeda do usuário
- Atualiza `recovery_leads.status` para `email_enviado`

**5. Página `RecuperacaoVendas.tsx`** — Nova página no painel do usuário.
- **Aba Config**: Editor de email com preview ao vivo (similar ao Upsell/Postagens)
  - Campo para assunto, corpo HTML com variáveis
  - Seção de cupom (toggle + código + descrição)
  - Campos de benefícios e garantia
  - Toggle de SMS + template SMS
  - Delay em minutos antes do disparo
- **Aba Leads**: Lista de leads capturados com status, filtros, e métricas (taxa de recuperação)
- **Webhook URL**: Exibida no topo para o usuário copiar

**6. Rota e Sidebar** — Adicionar `/recuperacao` nas rotas protegidas e no sidebar com ícone adequado.

**7. Integração no `Integracoes.tsx`** — Adicionar card "Recuperação de Vendas" com a URL do webhook de recovery visível.

### Variáveis Disponíveis (extraídas dos payloads)

Todos os checkouts já enviam dados suficientes para extrair:
- `{{nome_cliente}}` — customer.name
- `{{email_cliente}}` — customer.email
- `{{lista_produtos}}` — formatado do array products (nome x qty)
- `{{nome_produto_principal}}` — primeiro produto
- `{{valor_total}}` — total formatado em R$
- `{{link_checkout}}` — checkout_url do payload (quando disponível) ou campo manual
- `{{beneficio_principal}}`, `{{beneficio_1/2/3}}`, `{{garantia}}`, `{{ps_reforco_urgencia}}` — configurados pelo usuário
- `{{codigo_cupom}}`, `{{descricao_cupom}}` — condicionais

### Arquivos criados/alterados
- Nova migration SQL (2 tabelas: `recovery_config`, `recovery_leads`)
- `supabase/functions/webhook-recovery/index.ts` (novo)
- `supabase/functions/send-recovery-email/index.ts` (novo)
- `src/pages/RecuperacaoVendas.tsx` (novo)
- `src/App.tsx` (rota)
- `src/components/layout/AppSidebar.tsx` (menu)
- `supabase/config.toml` (verify_jwt = false para as novas functions)

### Escopo desta implementação
Dado o tamanho, sugiro implementar em **2 fases**:
- **Fase 1**: Tabelas + webhook + página de config com editor de email + preview + leads list
- **Fase 2**: Disparo automático com delay (cron ou scheduled), SMS, métricas de conversão

