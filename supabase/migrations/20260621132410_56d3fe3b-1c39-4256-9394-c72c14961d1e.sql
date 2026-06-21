-- Apaga eventos vinculados a templates de taxação/falha
DELETE FROM public.postagem_eventos
WHERE template_id IN (SELECT id FROM public.postagem_templates WHERE tipo IN ('taxacao','falha'));

-- Apaga eventos órfãos por status_label (caso existam sem template)
DELETE FROM public.postagem_eventos
WHERE status_label IN ('Taxação','Taxacao','Pago','Falha Entrega','Reenvio Pago','Reenvio Saiu');

-- Apaga os templates
DELETE FROM public.postagem_templates WHERE tipo IN ('taxacao','falha');

-- Remove colunas de configuração
ALTER TABLE public.postagem_config
  DROP COLUMN IF EXISTS ativar_taxacao,
  DROP COLUMN IF EXISTS taxacao_valor,
  DROP COLUMN IF EXISTS taxacao_template_id,
  DROP COLUMN IF EXISTS msg_taxacao,
  DROP COLUMN IF EXISTS ativar_falha_entrega,
  DROP COLUMN IF EXISTS valor_taxa_falha,
  DROP COLUMN IF EXISTS msg_falha_entrega,
  DROP COLUMN IF EXISTS checkout_url_falha;

-- Remove custos de sistema
DELETE FROM public.system_config WHERE key IN ('custo_taxacao','custo_falha_entrega');