ALTER TABLE public.lojas 
  ADD COLUMN webhook_token text 
  DEFAULT encode(gen_random_bytes(6), 'hex') 
  NOT NULL 
  UNIQUE;