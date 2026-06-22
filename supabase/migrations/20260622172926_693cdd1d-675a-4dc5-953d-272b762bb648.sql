ALTER TABLE public.global_flow_config
  ADD COLUMN IF NOT EXISTS confirm_email_template_en jsonb,
  ADD COLUMN IF NOT EXISTS confirm_email_template_es jsonb;