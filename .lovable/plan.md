# Fluxo Global — Emails e SMS por Etapa (EN + ES)

## Situação atual
O `send-global-flow` hoje usa **um único template HTML genérico** que apenas marca qual das 10 etapas é a "atual" numa checklist. O SMS é uma frase só (`"estado de tu pedido: X"`). Isto significa que as 10 etapas, na prática, mandam o **mesmo email** com título diferente — não é o nível que queremos.

## Objetivo
Construir conteúdo único, escrito à mão, para cada uma das 10 etapas, em **EN (US)** e **ES**, totalizando:
- 20 emails HTML (10 EN + 10 ES) com copy, headline, corpo e CTA próprios da etapa
- 20 mensagens SMS curtas (10 EN + 10 ES), cada uma com tom adequado à etapa (ex.: "saiu para entrega" tem urgência; "entregue" tem agradecimento)

Mantemos o visual base (header com cor, checklist de progresso, botão de rastreio, rodapé com nome da empresa e país de origem) — o que muda por etapa é **título, parágrafo intro, parágrafo de contexto e SMS**.

## Etapas e tom de cada uma

| # | Etapa (EN / ES) | Tom do email |
|---|---|---|
| 1 | Order Received / Pedido Recibido | Boas-vindas, confirmação, prazo estimado |
| 2 | Order Prepared / Pedido Preparado | Embalagem concluída, próximo passo |
| 3 | Shipped by Sender / Enviado por el Remitente | Saiu da loja, código de rastreio em destaque |
| 4 | Left Country of Origin / Salió del País de Origen | Despachado internacionalmente, menciona país de origem |
| 5 | In International Transit / En Tránsito Internacional | A caminho, tempo de voo/transporte |
| 6 | Arrived at Destination Country / Llegó al País de Destino | Chegada confirmada, próximo: alfândega |
| 7 | In Customs Processing / En Procesamiento Aduanero | Tranquilizador, processo normal, sem ação do cliente |
| 8 | In Local Transit / En Tránsito Local | Liberado, indo para centro de distribuição local |
| 9 | Out for Delivery / Salió para Entrega | Urgência positiva — "hoje!", pede alguém em casa |
| 10 | Delivered / Entregado | Agradecimento, pedido de feedback/avaliação |

## Arquitetura técnica

### Novo arquivo: `supabase/functions/send-global-flow/templates.ts`
Exporta dois objetos tipados:
```ts
export const EMAIL_TEMPLATES: Record<Lang, Record<1..10, {
  subject: (ctx) => string;
  preview: string;
  headline: string;
  intro: (name) => string;
  body: string;        // parágrafo principal da etapa
  hint?: string;       // dica opcional (ex.: "tenha alguém em casa")
  ctaLabel: string;
}>>

export const SMS_TEMPLATES: Record<Lang, Record<1..10, (ctx) => string>>
```

### `supabase/functions/send-global-flow/index.ts`
- Substituir `I18N.subject/preview/intro/...` e `I18N.sms` por leitura de `EMAIL_TEMPLATES[lang][step]` e `SMS_TEMPLATES[lang][step]`.
- Manter `buildEmailHtml` mas receber agora um objeto `content` da etapa (headline, intro, body, hint, ctaLabel) em vez do label fixo.
- A checklist visual das 10 etapas continua igual (mantém senso de progresso).
- Nada muda em custos, débito de créditos, RLS, ou na tabela `global_flow_eventos`.

### Sem mudanças em
- Frontend (`Global.tsx`)
- Migrations
- `send-payment-confirmation`
- Admin / custos

## Entrega
Um único PR: cria `templates.ts` com os 20 emails + 20 SMS escritos por extenso, e refatora `index.ts` para consumir. Deploy do `send-global-flow`.
