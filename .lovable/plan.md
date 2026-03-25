

## Plan: UAZAPI Verification Instance with QR Code Connection

### What changes

Replace the current manual token input in the "WhatsApp de Verificação" card on AdminSuporte with a full instance management flow (similar to user WhatsApp instances), where the admin:

1. Creates a UAZAPI instance via the admin token (`UAZAPI_ADMIN_TOKEN` secret, already configured)
2. Generates a QR code to connect a phone number
3. The connected instance token is stored in `system_config` and used by `send-verification-sms` to send WhatsApp codes

### Technical Details

**AdminSuporte.tsx — Replace UAZAPI card with instance flow:**
- "Criar Instância" button calls UAZAPI `/instance/init` via a new edge function action or directly via the existing `send-whatsapp` edge function (but admin-level, not loja-bound)
- Since this is an admin-only system instance (not tied to a loja), we'll create a dedicated edge function `admin-verification-whatsapp` that handles: `init`, `connect`, `status`, `disconnect`, `delete`
- Store instance data in `system_config` with keys:
  - `verificacao_whatsapp_token` — instance token (text_value)
  - `verificacao_whatsapp_instance` — instance name (text_value)
  - `verificacao_whatsapp_status` — connection status (text_value)
  - `verificacao_whatsapp_phone` — connected phone (text_value)
- UI states: No instance → Create button → QR code/pairing code → Connected status with disconnect/delete options
- Polling for status while connecting (same pattern as WhatsApp.tsx)
- Test send button remains

**New edge function `admin-verification-whatsapp`:**
- Validates admin role via JWT
- Actions: `init`, `connect`, `status`, `disconnect`, `delete`
- Uses `UAZAPI_ADMIN_TOKEN` for init, instance token for other actions
- Stores/updates `system_config` rows accordingly

**Database migration:**
- Insert new `system_config` rows for `verificacao_whatsapp_status` and `verificacao_whatsapp_phone`

**No changes to `send-verification-sms`** — it already reads the token from `system_config.verificacao_whatsapp_token` and sends WhatsApp messages.

### Files Modified
- `src/pages/admin/AdminSuporte.tsx` — full rewrite of UAZAPI card with QR code flow
- `supabase/functions/admin-verification-whatsapp/index.ts` — new edge function
- Database migration — add new system_config rows

