
CREATE OR REPLACE FUNCTION public.get_admin_user_activity()
RETURNS TABLE(
  user_id uuid,
  ultimo_deposito timestamptz,
  total_envios bigint,
  envios_30d bigint,
  ultimo_envio timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS user_id,
    (SELECT MAX(pp.paid_at) FROM pix_payments pp WHERE pp.user_id = p.id AND pp.status = 'PAID') AS ultimo_deposito,
    (SELECT COUNT(*) FROM lojas l JOIN envios e ON e.loja_id = l.id WHERE l.user_id = p.id AND e.deleted_at IS NULL) AS total_envios,
    (SELECT COUNT(*) FROM lojas l JOIN envios e ON e.loja_id = l.id WHERE l.user_id = p.id AND e.deleted_at IS NULL AND e.created_at > now() - interval '30 days') AS envios_30d,
    (SELECT MAX(e.created_at) FROM lojas l JOIN envios e ON e.loja_id = l.id WHERE l.user_id = p.id AND e.deleted_at IS NULL) AS ultimo_envio
  FROM profiles p
  WHERE has_role(auth.uid(), 'admin'::app_role);
$$;
