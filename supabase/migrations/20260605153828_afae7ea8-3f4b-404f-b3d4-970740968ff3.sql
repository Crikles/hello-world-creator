CREATE OR REPLACE FUNCTION public.get_envios_paginated(p_loja_id uuid, p_search text DEFAULT ''::text, p_status text DEFAULT 'todos'::text, p_metodo text DEFAULT 'todos'::text, p_origem text DEFAULT 'todos'::text, p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_page integer DEFAULT 1, p_per_page integer DEFAULT 50)
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_search TEXT := lower(coalesce(p_search,''));
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT e.*, p.method AS metodo, p.checkout_provider AS origem,
           COUNT(*) OVER () AS total_count
    FROM envios e
    LEFT JOIN pedidos p ON p.envio_id = e.id
    WHERE e.loja_id = p_loja_id AND e.deleted_at IS NULL
      AND (p_status = 'todos'
           OR e.status::text = p_status
           OR e.status_label = p_status)
      AND (p_metodo = 'todos' OR lower(coalesce(p.method,'')) LIKE '%'||lower(p_metodo)||'%')
      AND (p_origem = 'todos' OR p.checkout_provider = p_origem)
      AND (p_date_from IS NULL OR e.created_at >= p_date_from)
      AND (p_date_to IS NULL OR e.created_at <= p_date_to)
      AND (v_search = '' OR lower(e.cliente_nome) LIKE '%'||v_search||'%'
           OR lower(coalesce(e.cliente_email,'')) LIKE '%'||v_search||'%'
           OR lower(coalesce(e.codigo_rastreio,'')) LIKE '%'||v_search||'%'
           OR lower(coalesce(e.produto,'')) LIKE '%'||v_search||'%')
    ORDER BY e.created_at DESC
    LIMIT p_per_page OFFSET (GREATEST(p_page,1)-1) * p_per_page
  )
  SELECT to_jsonb(base.*) FROM base;
END $function$;