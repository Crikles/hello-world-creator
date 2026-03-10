
UPDATE envios e
SET postagem_template_id = pc.template_ativo_id
FROM postagem_config pc
WHERE e.loja_id = pc.loja_id
  AND e.postagem_template_id IS NULL
  AND pc.template_ativo_id IS NOT NULL;
