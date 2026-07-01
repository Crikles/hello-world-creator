
CREATE OR REPLACE FUNCTION public.get_loja_faturamento_por_moeda(p_loja_id uuid)
RETURNS TABLE(moeda text, total numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(moeda, 'BRL') AS moeda, COALESCE(SUM(valor), 0)::numeric AS total
  FROM envios
  WHERE loja_id = p_loja_id AND deleted_at IS NULL
  GROUP BY COALESCE(moeda, 'BRL')
  ORDER BY total DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_loja_chart_data_por_moeda(p_loja_id uuid)
RETURNS TABLE(dia text, moeda text, receita numeric, pedidos numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS dia,
         COALESCE(moeda, 'BRL') AS moeda,
         COALESCE(SUM(valor),0)::numeric AS receita,
         COUNT(*)::numeric AS pedidos
  FROM envios
  WHERE loja_id = p_loja_id AND deleted_at IS NULL
    AND created_at > now() - interval '30 days'
  GROUP BY 1, 2
  ORDER BY 1;
$$;
