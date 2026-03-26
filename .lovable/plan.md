

## Plan: Fix WhatsApp Auto-Send Not Firing

### Root Cause
The `auto-whatsapp-new-order` edge function was created but is **missing from `supabase/config.toml`**. Without the `verify_jwt = false` setting, calls from other edge functions are rejected with a 401 Unauthorized error. The `.catch(() => {})` in every webhook silently swallows this error, making it invisible.

### Changes

**1. Add `auto-whatsapp-new-order` to `supabase/config.toml`**

Add the missing config block:
```toml
[functions.auto-whatsapp-new-order]
verify_jwt = false
```

**2. Add error logging to webhook invocations**

Replace the silent `.catch(() => {})` in all 7 webhooks with a logged catch so future failures are visible:
```typescript
supabase.functions.invoke("auto-whatsapp-new-order", {
  body: { envio_id: newEnvio.id, loja_id: lojaId }
}).catch((err) => console.error("[auto-whatsapp] invoke error:", err));
```

Files affected:
- `webhook-vega/index.ts`
- `webhook-zedy/index.ts`
- `webhook-luna/index.ts`
- `webhook-corvex/index.ts`
- `webhook-adoorei/index.ts`
- `shopify-webhook/index.ts`
- `api-external/index.ts`

### What stays unchanged
- The `auto-whatsapp-new-order` function logic (already correct)
- The duplicate guard in `advance-shipments`
- Manual WhatsApp sending

