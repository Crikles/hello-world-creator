

## Plan: Add WhatsApp field to signup and display in Admin

### 1. Database migration
Add a `whatsapp` column to the `profiles` table and update the `handle_new_user` trigger to capture it from user metadata.

```sql
ALTER TABLE public.profiles ADD COLUMN whatsapp text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, whatsapp)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email, NEW.raw_user_meta_data->>'whatsapp');
  RETURN NEW;
END;
$$;
```

### 2. Add WhatsApp input to signup form (`src/components/ui/premium-auth.tsx`)
- Add a WhatsApp input field (with Phone icon) after the name field, only visible in signup mode
- Add validation: required, must be numeric, min 10 digits
- Pass the phone value through the `onSignup` callback (update signature to include `phone` parameter)

### 3. Update signup handlers
- **`src/pages/Login.tsx`** and **`src/pages/Signup.tsx`**: Update `handleSignup` to accept `phone` parameter and pass it as `user_metadata.whatsapp` in the `signUp` call
- Update `onSignup` prop type in `AuthFormProps` to `(email, password, name, phone) => Promise<void>`

### 4. Display WhatsApp in Admin (`src/pages/admin/AdminUsuarios.tsx`)
- Add `whatsapp` to the `UserRow` interface
- Fetch it from profiles query
- Add a "WhatsApp" column to the users table, displaying the number (or "—" if empty)

### Files changed
- **Database migration**: Add `whatsapp` column + update trigger
- **`src/components/ui/premium-auth.tsx`**: Add WhatsApp field to signup form
- **`src/pages/Login.tsx`**: Pass WhatsApp in signup metadata
- **`src/pages/Signup.tsx`**: Pass WhatsApp in signup metadata
- **`src/pages/admin/AdminUsuarios.tsx`**: Show WhatsApp column

