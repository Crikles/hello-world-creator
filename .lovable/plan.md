

## Plan: Fix AUTO bypass — Ensure disabled AUTO never starts new shipments

### Problem
Users report that with AUTO disabled, new orders from checkouts still get their flow started automatically instead of staying at stage zero (`pendente`). 

### Root Cause
The client-side realtime listener on the Envios page uses local React state (`autoEnvio`) to decide whether to auto-start new envios. This creates two vulnerabilities:
1. **Stale state across tabs**: If AUTO is disabled in one tab, another open tab still holds `autoEnvio = true` in memory
2. **No server-side re-check**: The client listener trusts its cached state without re-validating against the database before triggering

### Solution (2 changes)

**1. Client-side fix (`src/pages/Envios.tsx`)**
In the realtime INSERT listener (the AUTO channel), before calling `triggerNextEmail`, re-fetch `auto_envio` from `postagem_config` to confirm it's still enabled. If it's false/null in the DB, skip the trigger and log it.

```typescript
// Before triggering, re-check DB
const { data: freshConfig } = await supabase
  .from("postagem_config")
  .select("auto_envio")
  .eq("loja_id", loja.id)
  .maybeSingle();

if (!freshConfig?.auto_envio) {
  console.log("AUTO: skipped — auto_envio disabled in DB");
  return;
}
```

**2. Server-side safeguard (`supabase/functions/advance-shipments/index.ts`)**
The cron already checks `config.auto_envio` before processing pending shipments. However, the config is fetched once per loja per run. Add a comment reinforcing this is correct and ensure the check is explicit (not relying on type coercion for null):

Change `if ((config as any).auto_envio)` to `if ((config as any).auto_envio === true)` to prevent any truthy edge cases with unexpected values.

### Files to edit
1. `src/pages/Envios.tsx` — Add DB re-check in the AUTO realtime listener
2. `supabase/functions/advance-shipments/index.ts` — Stricten the `auto_envio` check to `=== true`

