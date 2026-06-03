INSERT INTO public.system_config (key, value) VALUES ('whatsapp_suporte', 5511962839694)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();