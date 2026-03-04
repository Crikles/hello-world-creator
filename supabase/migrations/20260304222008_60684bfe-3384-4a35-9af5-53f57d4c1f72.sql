ALTER TABLE public.pix_payments 
ADD CONSTRAINT pix_payments_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;