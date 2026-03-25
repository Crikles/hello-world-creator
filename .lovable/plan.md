

## Plan: WhatsApp Verification via UAZAPI on Admin Support Page

### What changes

1. **Admin Support page (`AdminSuporte.tsx`)** — Add a new card for configuring a UAZAPI instance dedicated to sending verification codes. Two fields stored in `system_config`:
   - `verificacao_whatsapp_token` — the UAZAPI instance token
   - `verificacao_whatsapp_instance` — the instance name (informational)
   
   The admin connects a UAZAPI instance and pastes the token. A test button sends a sample message to validate.

2. **Database migration** — Insert two new `system_config` rows:
   - `key: verificacao_whatsapp_token`, `value: 0`, `label: Token UAZAPI Verificação`
   - `key: verificacao_whatsapp_instance`, `value: 0`, `label: Nome Instância Verificação`
   
   Since `system_config.value` is numeric, we'll store the token as a new text column OR use a separate approach. Actually, `system_config.value` is numeric-only. We need a text field. We'll add a `text_value` column to `system_config` to store string configs like the token.

3. **Edge function `send-verification-sms`** — After sending SMS successfully, also send the same code via WhatsApp using the UAZAPI `/send/text` endpoint. The function will:
   - Read `verificacao_whatsapp_token` from `system_config`
   - If a token is configured, send a WhatsApp text message to the same phone number
   - This is best-effort: if WhatsApp fails, the SMS was already sent so the user still gets the code
   - No authentication or credits required since this is a system-level verification

### Technical Details

**New column on `system_config`:**
```sql
ALTER TABLE public.system_config ADD COLUMN text_value text;
```

**AdminSuporte.tsx changes:**
- Add a second card "WhatsApp de Verificação (UAZAPI)" with:
  - Input for instance token
  - Input for instance name (optional, display only)
  - Save button that upserts to `system_config` using `text_value`
  - Test button that calls the edge function with a test number

**Edge function `send-verification-sms` changes:**
- After successful SMS send, query `system_config` for `verificacao_whatsapp_token` (`text_value`)
- If token exists, call `https://rushsend.uazapi.com/send/text` with the same formatted phone and verification message
- Log result but don't block the response if WhatsApp fails

### Files Modified
- `src/pages/admin/AdminSuporte.tsx` — new UAZAPI config card
- `supabase/functions/send-verification-sms/index.ts` — add WhatsApp send after SMS
- Database migration — add `text_value` column to `system_config`

