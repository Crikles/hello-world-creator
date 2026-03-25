

## Plan: WhatsApp Verification with Editable Phone + Non-Expiring Codes + Admin Visibility

### What changes

1. **Popup asks user to input/confirm their WhatsApp number** before sending the code -- since many old users have random/invalid numbers stored. The popup gets a new "phone input" step where the user confirms or edits their WhatsApp. The confirmed number is saved to their profile before sending the code.

2. **Codes never expire** for the verification popup flow (existing users). The `send-verification-sms` edge function will set `expires_at` far in the future (e.g. year 2099) when `skip_email_check: true` (existing user flow). The `verify-sms-code` function already checks expiration, so this just works.

3. **Admin panel shows pending verification codes** for each unverified user. In the "Todos os Usuarios" table, for users who are "Nao verificado", show their latest pending code inline (so admin can help via support). This uses the already-fetched `pendingVerifications` data cross-referenced with user phone/email.

4. **Admin is also required to verify** -- remove any special bypass. The current popup in `WhatsAppVerificationPopup.tsx` already checks `profiles.whatsapp` and `signup_verifications` without admin exceptions, so this already works. Just confirm no bypass exists.

### Technical Details

**`WhatsAppVerificationPopup.tsx`:**
- Add new step `"phone"` before `"prompt"`. User sees their current WhatsApp pre-filled in an input, can edit it.
- On "Confirmar" in the phone step: update `profiles.whatsapp` with the new number, then proceed to send code.
- The `sendCodeMutation` uses the user-entered phone instead of reading from profile.
- Change step flow: `phone` → `code` (skip the old "prompt" step, go straight to sending after phone confirmation).

**`send-verification-sms/index.ts`:**
- When `skip_email_check: true`, set `expires_at` to `'2099-12-31T23:59:59Z'` instead of the default 10-min expiration.

**`AdminUsuarios.tsx`:**
- Fetch ALL pending verifications (not just status=pendente, also include the code field).
- In the "WA Verificado" column, for unverified users, show their latest pending code if one exists (e.g. "Codigo: 123456").
- Cross-reference by phone or email.

### Files Modified
- `src/components/WhatsAppVerificationPopup.tsx` -- add phone input step
- `supabase/functions/send-verification-sms/index.ts` -- non-expiring codes for existing users
- `src/pages/admin/AdminUsuarios.tsx` -- show pending codes for unverified users

