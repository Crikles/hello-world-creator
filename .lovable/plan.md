

## Plan: Fix WhatsApp Auto-Send for New Orders

### Problem
WhatsApp auto-send only fires inside the `advanceShipment()` function, which is part of the cron job. If `auto_envio` is OFF, new shipments stay at "pendente" and never advance, so WhatsApp is never triggered. Users expect WhatsApp messages to be sent automatically for new orders regardless of `auto_envio`.

### Solution
Add WhatsApp message sending directly in the webhook flows (Vega, Zedy, Luna, Corvex, Adoorei, Shopify, API Externa) at the moment a new shipment (`envio`) is created. This ensures the WhatsApp message goes out immediately when a new order arrives, without depending on the cron advance.

### Changes

**1. Create a shared helper Edge Function: `supabase/functions/auto-whatsapp-new-order/index.ts`**

A lightweight function that:
- Receives `envio_id` and `loja_id`
- Checks if `whatsapp_auto_send` is ON in `postagem_config`
- Fetches connected + active WhatsApp instances for the loja
- Builds the message from the template (same logic as in advance-shipments lines 823-862)
- Sends via UAZAPI and logs to `whatsapp_message_log`
- Only sends once per envio (checks if a log already exists for this envio_id)

**2. Call this function from each webhook that creates an envio**

After the `envios` INSERT succeeds in each webhook, invoke the new function:
- `webhook-vega/index.ts`
- `webhook-zedy/index.ts`
- `webhook-luna/index.ts`
- `webhook-corvex/index.ts`
- `webhook-adoorei/index.ts`
- `shopify-webhook/index.ts`
- `api-external/index.ts`

Each webhook will add a simple call after envio creation:
```typescript
// Fire-and-forget WhatsApp for new order
supabase.functions.invoke("auto-whatsapp-new-order", {
  body: { envio_id: newEnvio.id, loja_id: lojaId }
}).catch(() => {});
```

**3. Guard against duplicates in `advance-shipments`**

In `advanceShipment()` (line ~797), add a check: if `currentOrdem === 0` (first advance), skip WhatsApp auto-send since it was already sent at creation time. This prevents double messages.

### What stays unchanged
- Manual WhatsApp sending (1-by-1 for old orders) works as before
- The WhatsApp queue system for bulk sends remains intact
- `auto_envio` setting only controls automatic tracking advance, not WhatsApp
- Old orders (created before this change) will NOT receive automatic WhatsApp — only manual

### Technical Details
- The new function uses `SUPABASE_SERVICE_ROLE_KEY` for auth (server-to-server)
- Round-robin instance rotation reuses the same logic from advance-shipments
- The duplicate guard uses `whatsapp_message_log` — if a record already exists for the envio_id, skip sending
