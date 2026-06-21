## Objetivo

Criar uma aba **Global** (item no menu lateral, abaixo de "Confirmação Pgto") com um fluxo internacional padrão de 10 etapas. Quando ATIVADO, todo novo pedido **internacional** da loja dispara automaticamente Email + SMS em **inglês (US)** ou **espanhol (ES)** — sem edição de template pelo usuário. O fluxo nacional (Atlas/JetLine + emails PT) continua funcionando normalmente para pedidos brasileiros.

## 1. UI — nova página `/loja/:id/global`

Item de menu **"Global"** (ícone `Globe2`) no `AppSidebar`, na seção Operações logo após "Confirmação Pgto".

Página minimalista, sem editor de template:

- **Card "Status"**: Switch grande **ATIVAR / DESATIVAR Fluxo Global**
- **Card "Idioma"**: 2 botões — 🇺🇸 English (US) / 🇪🇸 Español
- **Card "Canais"**: dois toggles simples (Email / SMS) — ambos ON por padrão
- **Card "Pré-visualização"**: lista somente leitura das 10 etapas no idioma escolhido (Order Received, Order Prepared, Shipped by Sender, Left Country of Origin, In International Transit, Arrived at Destination Country, In Customs Processing, In Local Transit, Out for Delivery, Delivered)
- **Card "Como funciona"**: parágrafo explicando que apenas pedidos detectados como internacionais entram neste fluxo; pedidos BR seguem usando o fluxo nacional (Atlas/JetLine).

## 2. Backend — schema

Nova tabela `global_flow_config` (uma linha por loja):

| coluna | tipo |
| --- | --- |
| `loja_id` | uuid PK, FK lojas |
| `ativo` | boolean default false |
| `idioma` | text check in ('en','es') default 'en' |
| `enviar_email` | boolean default true |
| `enviar_sms` | boolean default true |
| `created_at` / `updated_at` | timestamptz |

GRANTs + RLS (owner da loja gerencia; admin tudo).

Adicionar **`envios.is_international`** (boolean default false). Detecção na criação do envio:
- `cliente_estado` vazio/não-BR (não está na lista dos 27 UFs) **ou**
- CEP não casa com `^\d{5}-?\d{3}$`
→ marcar `is_international = true`.

Adicionar `envios.global_flow_lang` (text, nullable) para travar o idioma usado no envio no momento da criação (evita inconsistência se o usuário trocar EN↔ES no meio do fluxo).

## 3. Edge function — `send-global-flow`

Nova função única, invocada a cada avanço de etapa do envio (no mesmo ponto onde hoje o `send-sms` / template de email é disparado).

Entrada: `{ envio_id, step }` onde `step` é 1..10.

Lógica:
1. Buscar envio + `global_flow_config` da loja.
2. Se config não ativa OU `envio.is_international = false` → ignora (return skip).
3. Resolver idioma: `envio.global_flow_lang` (fallback `config.idioma`).
4. Renderizar **um único template React Email** (`_shared/transactional-email-templates/global-tracking.tsx`) com array das 10 etapas e marca da `currentStep`. Strings em EN/ES vêm de um dicionário (sem `dangerouslySetInnerHTML`).
5. Renderizar SMS curto: `"{firstName}, your order status: {stepLabel}. Track: {link}"` (EN) / equivalente ES, sem acentos.
6. Enviar via `send-transactional-email` (Email) + provedor IntegraX (SMS), debitando créditos com os mesmos `custo_email_rastreio` / `custo_sms` já existentes.

## 4. Wiring com o fluxo de envios existente

No ponto onde os envios avançam de status (cron `advance-shipments` e/ou webhooks), adicionar:

```ts
if (envio.is_international) {
  // tenta global; se config inativa, função decide e retorna skip
  await supabase.functions.invoke("send-global-flow", { body: { envio_id, step } });
} else {
  // fluxo nacional atual (Atlas/JetLine) — inalterado
}
```

Mapear os status atuais (`pendente`, `em_transito`, `saiu_para_entrega`, `entregue`, etc.) → step number 1..10 numa única tabela de mapeamento dentro da função.

## 5. Confirmação de Pagamento padrão (EN/ES)

A função existente `send-payment-confirmation` ganha um **branch global**: se `global_flow_config.ativo = true` e o pedido é internacional, usa um template hardcoded de "Payment Confirmed" / "Pago confirmado" no idioma da config, em vez do template editável atual. Sem alterar a tabela `confirmacao_pagamento_config`.

## 6. Detalhes técnicos

- **Templates**: um único arquivo React Email com `<Section>` por etapa, etapas concluídas em verde, atual destacada em azul, futuras em cinza. Dicionário inline `{en: {...}, es: {...}}`.
- **i18n**: nenhuma lib — só dicionário em JSON.
- **Idioma trava no envio**: snapshot em `envios.global_flow_lang` na criação.
- **Pedidos antigos não migram**: ativação só vale para envios criados após o switch (já é o comportamento natural pois `is_international` é setado na criação).
- **Site público de rastreio internacional**: ficará a cargo do "outro projeto" conforme você indicou; aqui só geramos o link `{baseUrl}/r/{codigo}` (mesma URL atual da Atlas até o novo site existir).

## Arquivos a criar / editar

**Criar**
- `src/pages/Global.tsx`
- `supabase/functions/send-global-flow/index.ts`
- `supabase/functions/_shared/transactional-email-templates/global-tracking.tsx`
- migration: tabela `global_flow_config` + colunas `envios.is_international`, `envios.global_flow_lang`

**Editar**
- `src/components/layout/AppSidebar.tsx` — item "Global"
- `src/App.tsx` — rota `global`
- `supabase/functions/advance-shipments/index.ts` — branch internacional → `send-global-flow`
- Webhooks que criam envios — setar `is_international` e `global_flow_lang`
- `supabase/functions/send-payment-confirmation/index.ts` — branch internacional

## Fora de escopo (próxima fase)

- Site público de rastreio internacional (outro projeto).
- Editor de templates Global (será sempre padrão).
- WhatsApp no fluxo Global.
- Migrar envios antigos para o fluxo Global.
