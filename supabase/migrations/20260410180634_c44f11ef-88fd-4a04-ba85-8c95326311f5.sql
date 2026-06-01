
CREATE OR REPLACE FUNCTION public.get_loja_faturamento(p_loja_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(valor), 0) FROM envios 
  WHERE loja_id = p_loja_id AND deleted_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.get_loja_chart_data(p_loja_id uuid)
RETURNS TABLE(dia date, receita numeric, pedidos bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT created_at::date AS dia, SUM(valor) AS receita, COUNT(*) AS pedidos
  FROM envios
  WHERE loja_id = p_loja_id AND deleted_at IS NULL
  GROUP BY created_at::date
  ORDER BY created_at::date;
$$;
