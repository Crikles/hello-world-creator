
CREATE TABLE public.sms_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  envio_id uuid REFERENCES public.envios(id) ON DELETE CASCADE,
  loja_id uuid NOT NULL,
  user_id uuid,
  evento_id uuid,
  status_label text,
  status text NOT NULL DEFAULT 'sent',
  motivo text,
  telefone text,
  custo numeric NOT NULL DEFAULT 0,
  provider_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sms_log_loja_created_idx ON public.sms_log(loja_id, created_at DESC);
CREATE INDEX sms_log_envio_idx ON public.sms_log(envio_id);
CREATE INDEX sms_log_envio_evento_idx ON public.sms_log(envio_id, evento_id) WHERE status = 'sent';

GRANT SELECT ON public.sms_log TO authenticated;
GRANT ALL ON public.sms_log TO service_role;

ALTER TABLE public.sms_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads sms_log"
ON public.sms_log FOR SELECT
TO authenticated
USING (public.user_owns_loja(auth.uid(), loja_id));

CREATE POLICY "Admin manages sms_log"
ON public.sms_log FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
