ALTER TABLE public.postagem_config
  DROP COLUMN IF EXISTS failed_delivery_template_id,
  DROP COLUMN IF EXISTS failed_delivery_cost;