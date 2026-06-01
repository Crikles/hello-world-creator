DO $$
DECLARE
  p RECORD;
  new_envio_id uuid;
  produto_json text;
  qtd_total int;
  cust jsonb;
  addr jsonb;
  prods jsonb;
  empresa_uuid uuid;
BEGIN
  SELECT id INTO empresa_uuid FROM empresas WHERE loja_id = '522698d9-4e84-469c-a193-e323b2529978' LIMIT 1;

  FOR p IN
    SELECT * FROM pedidos
    WHERE loja_id = '522698d9-4e84-469c-a193-e323b2529978'
      AND status='paid' AND envio_id IS NULL
    ORDER BY created_at
  LOOP
    cust := p.raw_payload->'customer';
    addr := COALESCE(cust->'address', '{}'::jsonb);
    prods := COALESCE(p.products, '[]'::jsonb);

    SELECT string_agg(json_build_object('nome', x->>'title', 'quantidade', COALESCE((x->>'quantity')::int,1))::text, ',')
      INTO produto_json
      FROM jsonb_array_elements(prods) x;
    produto_json := COALESCE('[' || produto_json || ']', '[]');

    SELECT COALESCE(SUM(COALESCE((x->>'quantity')::int,1)), 1) INTO qtd_total
      FROM jsonb_array_elements(prods) x;

    INSERT INTO envios (
      cliente_nome, cliente_email, cliente_cpf, cliente_telefone,
      cliente_endereco, cliente_numero, cliente_bairro, cliente_cep,
      cliente_cidade, cliente_estado, cliente_complemento,
      produto, quantidade, valor, status, loja_id, empresa_id
    ) VALUES (
      COALESCE(p.customer_name, 'Cliente'),
      COALESCE(p.customer_email, 'sem-email@zedy.com'),
      p.customer_document, p.customer_phone,
      p.address_street, p.address_number, p.address_district, p.address_zip_code,
      p.address_city, p.address_state, p.address_complement,
      produto_json, qtd_total, p.total_price::numeric / 100,
      'pendente', p.loja_id, empresa_uuid
    ) RETURNING id INTO new_envio_id;

    UPDATE pedidos SET envio_id = new_envio_id WHERE id = p.id;
  END LOOP;
END $$;