## Objetivo

Adicionar ao card "Email de Confirmação de Pagamento" (aba **Canais & Custos** do Fluxo Global) um botão **"Personalizar email"** que abre um editor com **preview ao vivo** dos templates em **Inglês** e **Espanhol**. O usuário edita, salva, e a partir daí o `send-payment-confirmation` envia o template personalizado da loja (com fallback para o padrão atual).

## O que será construído

### 1. Banco — armazenar templates personalizados por loja

Migration adicionando ao `global_flow_config`:
- `confirm_email_template_en jsonb` — template personalizado em inglês (nullable = usa padrão)
- `confirm_email_template_es jsonb` — template personalizado em espanhol (nullable = usa padrão)

Cada JSON guarda os campos editáveis:
```
{ header, preview, greeting, intro, product_label, value_label, cta, footer, accent_color }
```
Variáveis dinâmicas suportadas: `{{nome}}`, `{{produto}}`, `{{valor}}`, `{{empresa}}`, `{{origem}}`, `{{tracking_url}}`.

### 2. Edge Function — usar o template salvo

Atualizar `supabase/functions/send-payment-confirmation/index.ts`:
- Ler `global_flow_config.confirm_email_template_{lang}` da loja.
- Se existir, mesclar sobre os defaults (`GLOBAL_CONFIRM_I18N[lang]`) antes de renderizar `buildGlobalConfirmationEmail`.
- Se nulo, comportamento atual (template padrão) — nenhum envio é quebrado.

### 3. UI — Editor com Preview lado a lado

Novo componente `src/components/global/GlobalPaymentEmailEditor.tsx`, aberto por **Dialog** a partir do card "Email de Confirmação de Pagamento" em `src/pages/Global.tsx`.

Layout do Dialog (responsivo, em telas grandes 2 colunas):
```text
┌────────────── Personalizar Email de Confirmação ──────────────┐
│ [Tabs: 🇺🇸 English | 🇪🇸 Español]                              │
├──────────────────────────┬────────────────────────────────────┤
│ FORMULÁRIO               │ PREVIEW (iframe sandbox)           │
│ • Cabeçalho              │  ┌──────────────────────────────┐  │
│ • Preview text           │  │ Payment Confirmed            │  │
│ • Saudação               │  │ Acme Corp · Shipped from CN  │  │
│ • Intro                  │  │                              │  │
│ • Label Produto/Valor    │  │ Hi John,                     │  │
│ • Texto do botão         │  │ Your payment...              │  │
│ • Rodapé                 │  │ [Track your order]           │  │
│ • Cor de destaque        │  │ Thank you...                 │  │
│ Variáveis: {{nome}}...   │  └──────────────────────────────┘  │
│ [Restaurar padrão]       │                                    │
├──────────────────────────┴────────────────────────────────────┤
│                              [Cancelar]  [Salvar alterações]  │
└────────────────────────────────────────────────────────────────┘
```

- O preview é renderizado em `<iframe srcDoc>` usando a **mesma função de build do edge function** — extraída para `src/lib/global-confirm-email.ts` (compartilhada). Garante 1:1 entre preview e envio real.
- Dados de exemplo (`nome: "John Doe"`, `produto: "Wireless Earbuds"`, `valor: "199,90"`, etc.) são usados no preview.
- Botão **"Restaurar padrão"** por idioma — limpa o template daquele idioma (volta a usar o default `GLOBAL_CONFIRM_I18N`).
- **Salvar** chama upsert em `global_flow_config` (RLS já cobre via `user_owns_loja`).

### 4. Botão no card existente

No card "Email de Confirmação de Pagamento" de `src/pages/Global.tsx`, adicionar um botão sutil "Personalizar" (ícone `Pencil`) ao lado do switch que abre o Dialog. Não muda o resto da estrutura do card.

## Arquivos afetados

- **Novo:** `supabase/migrations/<timestamp>_global_confirm_templates.sql`
- **Novo:** `src/lib/global-confirm-email.ts` (renderer compartilhado FE/BE — versão TS pura)
- **Novo:** `supabase/functions/_shared/global-confirm-email.ts` (mesmo renderer para Deno)
- **Novo:** `src/components/global/GlobalPaymentEmailEditor.tsx`
- **Editado:** `src/pages/Global.tsx` (botão Personalizar no card)
- **Editado:** `supabase/functions/send-payment-confirmation/index.ts` (carregar template custom)
- **Editado:** `src/integrations/supabase/types.ts` (após migration)

## Fora do escopo (manter para depois se quiser)

- Editor visual rich-text (será baseado em campos estruturados + cor — mais previsível e seguro).
- Upload de logo dentro do email (usa logo da loja já cadastrado, se houver).
- Edição do template de Email de Rastreio (apenas Confirmação por enquanto, conforme pedido).
