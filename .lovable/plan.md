

## Plan: Add "Indicação" Column to Admin Users Table

### What
Add a new column "Indicação" to the users table in the admin panel that shows:
1. Who referred this user (the referrer's name/email)
2. The user's own referral link (`/signup?ref=CODE`)

### How

**File: `src/pages/admin/AdminUsuarios.tsx`**

1. **Update the `UserRow` interface** — add `referred_by_name`, `referred_by_email`, and `referral_code` fields.

2. **Update the query** — the `profiles` query already returns `referred_by` and `referral_code`. Use the profiles list to resolve the referrer's name/email by matching `referred_by` to another profile's `id`.

3. **Add table column** — insert a "Indicação" column between "Lojas" and "Ações" showing:
   - If referred: referrer's name (or email) as a badge
   - The user's own referral link as a copyable code snippet
   - If not referred: just show their ref link

### Technical Details

- Map `profiles.referred_by` → lookup referrer name from the same profiles array (no extra query needed)
- Display referral code as `magnusfrete.lovable.app/signup?ref=CODE` with a copy button
- Show referrer info with a small label like "Indicado por: Nome"

