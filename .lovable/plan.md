

## Plano: Mostrar valor do reenvio/taxação em vez do valor do produto

### Problema
As páginas de Falha na Entrega e Taxação exibem `envio.valor` (preço do produto), mas o correto seria mostrar o valor configurado pelo lojista para reenvio/taxação.

### Alterações

**1. `src/pages/FalhaEntrega.tsx`**
- Buscar `valor_taxa_falha` da tabela `postagem_config` na query existente (junto com `template_ativo_id`)
- Usar esse valor no lugar de `envio.valor` em:
  - Card de cada envio (`R$ X.XX`)
  - Métrica "Valor Pendente" (somatório = `valor_taxa_falha * qtd_pendentes`)

**2. `src/pages/Taxacao.tsx`**
- Buscar o `corpo_email` do evento de Taxação na query `taxEventosMap` e extrair `{{taxacao_valor:XX.XX}}` via regex
- Usar esse valor no lugar de `envio.valor` em:
  - Card de cada envio
  - Métrica "Valor Pendente" (somatório = `valor_taxacao * qtd_pendentes`)

### Lógica
Como o valor é fixo por loja (configurado uma vez), o cálculo do total pendente será simplesmente `valor_configurado * quantidade_pendentes`.

