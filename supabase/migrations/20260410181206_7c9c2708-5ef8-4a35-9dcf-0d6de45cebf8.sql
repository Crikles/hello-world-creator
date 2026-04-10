
-- Function to get envios stats (counts by status)
CREATE OR REPLACE FUNCTION public.get_envios_stats(p_loja_id uuid)
RETURNS TABLE(total bigint, pendentes bigint, em_transito bigint, entregues bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status = 'pendente') AS pendentes,
    COUNT(*) FILTER (WHERE status = 'em_transito') AS em_transito,
    COUNT(*) FILTER (WHERE status = 'entregue') AS entregues
  FROM envios
  WHERE loja_id = p_loja_id AND deleted_at IS NULL;
$$;

-- Function to get paginated envios with filters and pedido join
CREATE OR REPLACE FUNCTION public.get_envios_paginated(
  p_loja_id uuid,
  p_search text DEFAULT '',
  p_status text DEFAULT 'todos',
  p_metodo text DEFAULT 'todos',
  p_origem text DEFAULT 'todos',
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_page int DEFAULT 1,
  p_per_page int DEFAULT 20
)
RETURNS TABLE(
  id uuid,
  cliente_nome text,
  cliente_email text,
  cliente_cpf text,
  cliente_telefone text,
  cliente_endereco text,
  cliente_numero text,
  cliente_bairro text,
  cliente_complemento text,
  cliente_cidade text,
  cliente_estado text,
  cliente_cep text,
  produto text,
  valor numeric,
  quantidade int,
  unidade text,
  cfop text,
  ncm_sh text,
  cst text,
  codigo_rastreio text,
  transportadora text,
  status shipment_status,
  status_label text,
  ultimo_evento_ordem int,
  proximo_avanco_em timestamptz,
  postagem_template_id uuid,
  nfe_numero text,
  nfe_serie text,
  nfe_chave_acesso text,
  empresa_id uuid,
  loja_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz,
  origem text,
  metodo_pagamento text,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset int;
  v_total bigint;
  v_search text;
BEGIN
  v_offset := (p_page - 1) * p_per_page;
  v_search := lower(COALESCE(p_search, ''));

  -- Count total matching records
  SELECT COUNT(*) INTO v_total
  FROM envios e
  LEFT JOIN pedidos p ON p.envio_id = e.id AND p.loja_id = e.loja_id
  WHERE e.loja_id = p_loja_id
    AND e.deleted_at IS NULL
    AND (v_search = '' OR (
      lower(e.cliente_nome) LIKE '%' || v_search || '%'
      OR lower(e.produto) LIKE '%' || v_search || '%'
      OR lower(COALESCE(e.codigo_rastreio, '')) LIKE '%' || v_search || '%'
      OR lower(e.cliente_email) LIKE '%' || v_search || '%'
      OR e.valor::text LIKE '%' || v_search || '%'
    ))
    AND (p_status = 'todos'
      OR e.status_label = p_status
      OR (p_status = 'Pendente' AND e.status = 'pendente' AND e.status_label IS NULL)
    )
    AND (p_date_from IS NULL OR e.created_at >= p_date_from)
    AND (p_date_to IS NULL OR e.created_at <= p_date_to)
    AND (p_metodo = 'todos' OR (
      (p_metodo = 'pix' AND lower(COALESCE(p.method, '')) LIKE '%pix%')
      OR (p_metodo = 'cartao' AND (lower(COALESCE(p.method, '')) LIKE '%card%' OR lower(COALESCE(p.method, '')) LIKE '%cartao%' OR lower(COALESCE(p.method, '')) LIKE '%cartão%' OR lower(COALESCE(p.method, '')) LIKE '%credit%'))
      OR (p_metodo = 'boleto' AND lower(COALESCE(p.method, '')) LIKE '%boleto%')
    ))
    AND (p_origem = 'todos' OR (
      (p_origem = 'manual' AND p.checkout_provider IS NULL)
      OR (p_origem != 'manual' AND p.checkout_provider = p_origem)
    ));

  RETURN QUERY
  SELECT
    e.id, e.cliente_nome, e.cliente_email, e.cliente_cpf, e.cliente_telefone,
    e.cliente_endereco, e.cliente_numero, e.cliente_bairro, e.cliente_complemento,
    e.cliente_cidade, e.cliente_estado, e.cliente_cep,
    e.produto, e.valor, e.quantidade, e.unidade,
    e.cfop, e.ncm_sh, e.cst,
    e.codigo_rastreio, e.transportadora,
    e.status, e.status_label, e.ultimo_evento_ordem,
    e.proximo_avanco_em, e.postagem_template_id,
    e.nfe_numero, e.nfe_serie, e.nfe_chave_acesso, e.empresa_id, e.loja_id,
    e.created_at, e.updated_at, e.deleted_at,
    p.checkout_provider AS origem,
    p.method AS metodo_pagamento,
    v_total AS total_count
  FROM envios e
  LEFT JOIN pedidos p ON p.envio_id = e.id AND p.loja_id = e.loja_id
  WHERE e.loja_id = p_loja_id
    AND e.deleted_at IS NULL
    AND (v_search = '' OR (
      lower(e.cliente_nome) LIKE '%' || v_search || '%'
      OR lower(e.produto) LIKE '%' || v_search || '%'
      OR lower(COALESCE(e.codigo_rastreio, '')) LIKE '%' || v_search || '%'
      OR lower(e.cliente_email) LIKE '%' || v_search || '%'
      OR e.valor::text LIKE '%' || v_search || '%'
    ))
    AND (p_status = 'todos'
      OR e.status_label = p_status
      OR (p_status = 'Pendente' AND e.status = 'pendente' AND e.status_label IS NULL)
    )
    AND (p_date_from IS NULL OR e.created_at >= p_date_from)
    AND (p_date_to IS NULL OR e.created_at <= p_date_to)
    AND (p_metodo = 'todos' OR (
      (p_metodo = 'pix' AND lower(COALESCE(p.method, '')) LIKE '%pix%')
      OR (p_metodo = 'cartao' AND (lower(COALESCE(p.method, '')) LIKE '%card%' OR lower(COALESCE(p.method, '')) LIKE '%cartao%' OR lower(COALESCE(p.method, '')) LIKE '%cartão%' OR lower(COALESCE(p.method, '')) LIKE '%credit%'))
      OR (p_metodo = 'boleto' AND lower(COALESCE(p.method, '')) LIKE '%boleto%')
    ))
    AND (p_origem = 'todos' OR (
      (p_origem = 'manual' AND p.checkout_provider IS NULL)
      OR (p_origem != 'manual' AND p.checkout_provider = p_origem)
    ))
  ORDER BY e.created_at DESC
  LIMIT p_per_page
  OFFSET v_offset;
END;
$$;
