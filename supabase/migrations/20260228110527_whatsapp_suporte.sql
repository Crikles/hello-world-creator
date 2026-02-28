INSERT INTO public.system_config (key, value, label)
VALUES ('whatsapp_suporte', 5511999999999, 'WhatsApp Suporte')
ON CONFLICT (key) DO NOTHING;
