

## Plan: Adjust billing logic and AUTO priority in advance-shipments

After reviewing the codebase, the core AUTO + billing flow is mostly correct, but there are a few discrepancies and missing pieces between `advance-shipments` (server-side cron) and `email-trigger.ts` (client-side):

### Issues Found

1. **Missing `custo_falha_entrega` in advance-shipments**: The cron function calculates costs for NF-e, Email, and Taxacao, but does NOT include `custo_falha_entrega` when `ativar_falha_entrega` is active. The client-side `email-trigger.ts` does include it. This means the cron undercharges.

2. **Missing "Falha Entrega" event filter in advance-shipments**: The client-side `email-trigger.ts` filters out "Falha Entrega" events when `ativar_falha_entrega` is disabled. The cron function does NOT filter, causing it to send unwanted Falha Entrega emails.

3. **Priority already correct**: Estaca 0 (AUTO-START section) runs before the ADVANCE section, so new orders already have priority. No change needed here.

4. **Credit recovery already works**: When a user has no credits, `advanceShipment` returns `false` and the shipment stays at estaca 0. Next cron run (15 min later), if credits are available, it picks them up. This is correct.

### Changes

#### 1. Fix `supabase/functions/advance-shipments/index.ts`

**a) Add `custo_falha_entrega` to initial debit calculation** (around line 475):
```typescript
if (config.ativar_falha_entrega && costMap["custo_falha_entrega"]) {
    total += costMap["custo_falha_entrega"];
    activeServices.push("Falha na Entrega");
}
```

**b) Filter out "Falha Entrega" events when disabled** (after fetching allEvents, around line 346):
Filter events the same way `email-trigger.ts` does — remove "Falha Entrega"/"Falha na Entrega" events when `ativar_falha_entrega` is false. Use the filtered list for both `nextEvent` lookup and status calculation.

**c) No other changes needed**: The AUTO check, credit skip, and priority logic are all correct.

### Files changed
- **`supabase/functions/advance-shipments/index.ts`**: Add falha_entrega cost + event filtering to match client-side logic

