

## Plan: Fix PIX payments visibility and customer name in BlackCat

There are two root causes for the issues:

### Problem 1: Admin can't see payments (profiles join fails)
The `pix_payments` table has no foreign key from `user_id` to `profiles.id`, so the Supabase join `profiles(full_name, email)` silently returns null. The admin panel query works but user info shows as "—".

### Problem 2: BlackCat shows admin name instead of user name
The `create-pix-payment` edge function correctly authenticates the user via JWT and fetches their profile. However, the profile query uses the service role client (`supabase`) which should work. The issue is likely that newer users don't have their `full_name` properly saved in profiles (the trigger may have failed or name wasn't provided), so it falls back to generic values. Additionally, the `customer.document.number` is hardcoded as `"00000000000"` which may cause the gateway to use a default/admin name.

### Problem 3: Payments not showing as PENDING
The user's SELECT RLS policy (`auth.uid() = user_id`) should work, but without a proper FK relationship the admin panel join breaks. Also need to verify the insert is succeeding.

---

### Changes

#### 1. Database migration: Add foreign key from `pix_payments.user_id` to `profiles.id`
This enables the Supabase PostgREST join to work properly in the admin query.

```sql
ALTER TABLE public.pix_payments 
ADD CONSTRAINT pix_payments_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
```

#### 2. Update `create-pix-payment` edge function
- Fetch the user's `full_name`, `email`, and `whatsapp` (phone) from profiles
- Use the real user name and phone in the BlackCat `customer` payload instead of hardcoded placeholders
- This ensures the gateway shows the correct account name

#### 3. Update `AdminPagamentos.tsx`
- Add `whatsapp` to the profiles join and display it in the table (so admin can see who recharged and contact them)
- Add `transaction_id` column for reference
- The FK added in step 1 will make the existing join actually return data

### Files changed
- **Database migration**: Add FK constraint
- **`supabase/functions/create-pix-payment/index.ts`**: Use real user data in BlackCat payload
- **`src/pages/admin/AdminPagamentos.tsx`**: Add WhatsApp and transaction ID columns

