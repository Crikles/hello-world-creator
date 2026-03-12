

# Pausar avanço automático em etapas que exigem aprovação manual

## Problema

Atualmente, o cron `advance-shipments` avança **todos** os envios cujo `proximo_avanco_em` já passou, incluindo os que estão parados em "Falha Entrega" e "Taxação". Essas etapas deveriam **pausar** e esperar a aprovação manual do usuário no painel antes de avançar para "Reenvio Pago" / "Pago".

O mesmo vale para o `triggerNextEmail` no client-side quando chamado por fluxos automáticos (ex: botão "Avançar Todos").

## Solução

Adicionar uma verificação no cron: se o `status_label` atual do envio é "Falha Entrega" ou "Taxação", **pular** o envio (não avançar automaticamente). A aprovação manual continua funcionando normalmente pelas páginas Taxação e Falha na Entrega, que chamam `triggerNextEmail` diretamente.

## Mudanças

### 1. `supabase/functions/advance-shipments/index.ts` — função `advanceShipment()` (~linha 517-520)

Após obter o `currentOrdem` e antes de buscar o `nextEvent`, verificar se o envio está pausado:

```typescript
const currentOrdem = shipment.ultimo_evento_ordem ?? 0;

// Pause: don't auto-advance shipments waiting for manual approval
const pauseLabels = ["Falha Entrega", "Taxação", "Taxacao"];
if (pauseLabels.includes(shipment.status_label || "")) {
  console.log(`Skip envio ${envioId}: waiting for manual approval (${shipment.status_label})`);
  return false;
}

const nextEvent = filteredEvents.find((e: any) => e.ordem > currentOrdem);
```

### 2. `src/lib/email-trigger.ts` — função `triggerNextEmail()` (~linha 96-97)

Adicionar a mesma verificação, mas **respeitando** o parâmetro `forceAdvance` (usado pelo botão "Forçar Avanço") e `forceSendEmail` (usado pela aprovação manual nas páginas Taxação/Falha):

```typescript
const currentOrdem = (shipment as any).ultimo_evento_ordem ?? 0;

// Pause: don't auto-advance shipments waiting for manual approval
// unless forceSendEmail (manual approval) or forceAdvance is true
const pauseLabels = ["Falha Entrega", "Taxação", "Taxacao"];
if (!forceSendEmail && !forceAdvance && pauseLabels.includes((shipment as any).status_label || "")) {
  console.log("Trigger skip: waiting for manual approval", envioId, (shipment as any).status_label);
  return null;
}

const nextEvent = filteredEvents.find(e => e.ordem > currentOrdem);
```

## Resultado

- Envio chega em "Falha Entrega" → **para**. Só avança para "Reenvio Pago" quando o usuário clica "Aprovar" no painel.
- Envio chega em "Taxação" → **para**. Só avança para "Pago" quando o usuário aprova no painel de Taxação.
- O `delay_horas` do próximo evento é **ignorado** nessas etapas — o avanço depende exclusivamente da ação manual.
- Botão "Forçar Avanço" (⚡) continua funcionando normalmente.

## Arquivos alterados
- `supabase/functions/advance-shipments/index.ts`
- `src/lib/email-trigger.ts`

