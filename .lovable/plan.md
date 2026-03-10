

## Plan: Skip NF-e events entirely when "Nota Fiscal por E-mail" is disabled

### Root cause

When `enviar_nfe_email` is disabled, the NF-e event is still **processed as a step in the flow** — the shipment advances through it, wastes a status transition, and may even generate the PDF. The email is correctly suppressed, but the event should be **filtered out entirely** from the flow (same pattern used for "Falha Entrega" events).

Currently, only the email send is gated by `isAtivo`. The event itself still occupies a slot in the sequence, causing an unnecessary step and potentially confusing status transitions.

### Fix

Filter out events where `enviar_nfe_pdf = true` when `enviar_nfe_email` is disabled — applied to the event list BEFORE determining the next event. This is the same pattern already used for Falha Entrega filtering.

### Changes

#### 1. `supabase/functions/advance-shipments/index.ts` (event filtering, ~line 349)

Extend the existing filter to also remove NF-e events when disabled:

```typescript
const filteredEvents = allEvents.filter((e: any) => {
  // Remove Falha Entrega events when disabled
  if (!config.ativar_falha_entrega) {
    const label = (e.status_label || "").toLowerCase();
    if (label.includes("falha") && !label.includes("pago")) return false;
  }
  // Remove NF-e events when enviar_nfe_email is disabled
  if (!config.enviar_nfe_email && e.enviar_nfe_pdf) return false;
  return true;
});
```

Also move the PDF generation inside the `isAtivo` check (line 560) so no PDF is generated when NF-e is disabled.

#### 2. `src/lib/email-trigger.ts` (event filtering, ~line 67)

Apply the same NF-e filter to the client-side trigger:

```typescript
// Existing Falha Entrega filter + new NF-e filter
const filteredEvents = allEvents.filter(e => {
  if ((e.status_label === "Falha Entrega" || e.nome === "Falha na Entrega") && !config.ativar_falha_entrega) return false;
  if (!config.enviar_nfe_email && e.enviar_nfe_pdf) return false;
  return true;
});
```

### Result

- NF-e disabled → NF-e event is skipped entirely, flow goes directly from previous step to next step
- NF-e enabled → works as before (generates PDF, sends email with attachment)
- No billing or status changes needed — filtering happens before any processing

### Files changed
- `supabase/functions/advance-shipments/index.ts`: Filter NF-e events + gate PDF generation
- `src/lib/email-trigger.ts`: Filter NF-e events from client-side trigger

