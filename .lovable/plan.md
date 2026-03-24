

## Plan: Block Webhook Events When Integration is Disabled

### Problem
Currently, when a user deactivates an integration (sets `ativo = false`), webhook events from that checkout are still processed and create pedidos/envios. The toggle is cosmetic only.

### Solution
Add an `ativo` check in each webhook Edge Function right after resolving the loja. If the integration is disabled (`ativo = false`), return a 200 response with `{ success: true, skipped: true, reason: "integration_disabled" }` without creating any records.

### Changes

**6 Edge Functions** (same pattern in each):

After resolving `lojaId`, query `checkout_integrations` for `ativo` status and return early if disabled:

```typescript
// Check if integration is active
const { data: integrationStatus } = await supabase
  .from("checkout_integrations")
  .select("ativo")
  .eq("loja_id", lojaId)
  .eq("checkout_id", "<checkout_id>")
  .maybeSingle();

if (integrationStatus?.ativo === false) {
  return new Response(
    JSON.stringify({ success: true, skipped: true, reason: "integration_disabled" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

Files to edit:
1. `supabase/functions/webhook-vega/index.ts` - checkout_id: "vega"
2. `supabase/functions/webhook-zedy/index.ts` - checkout_id: "zedy"
3. `supabase/functions/webhook-luna/index.ts` - checkout_id: "luna"
4. `supabase/functions/webhook-corvex/index.ts` - checkout_id: "corvex"
5. `supabase/functions/webhook-adoorei/index.ts` - checkout_id: "adoorei"
6. `supabase/functions/shopify-webhook/index.ts` - checkout_id: "shopify"

**Note**: If no row exists in `checkout_integrations` for that loja+checkout (i.e. `integrationStatus` is null), the webhook will still process normally (default behavior = active). Only an explicit `ativo = false` blocks processing.

### No DB or frontend changes needed
The `ativo` column and toggle UI already exist. This is purely a server-side enforcement.

