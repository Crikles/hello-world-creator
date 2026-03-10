

# Personalização Completa de Cores — Taxação e Falha na Entrega

## Objetivo
Dar liberdade total ao usuário para customizar as cores de todos os elementos visuais das páginas de Taxação e Falha na Entrega, incluindo títulos de seção, labels, descrições e backgrounds.

## Novos campos de cor (ambos os componentes)

| Campo | Default Taxação | Default Falha | Controla |
|---|---|---|---|
| `cor_titulo_resumo` | `#020617` | `#020617` | Título "Resumo da Cobrança" / "Resumo do Reenvio" |
| `cor_label_taxa` | `#020617` | `#020617` | "Total a pagar" / "Taxa de Reenvio" |
| `cor_descricao` | `#92400e` (amber-900) | `#9a3412` (orange-900) | Texto da descrição fixa |
| `cor_fundo_descricao` | `#fffbeb` (amber-50) | `#fff7ed` (orange-50) | Background do box da descrição |
| `cor_borda_descricao` | `#fde68a80` | `#fed7aa80` | Borda do box da descrição |
| `mensagem_site` | (const fixa atual) | (const fixa atual) | Texto da descrição — agora editável |

Total: 5 novas cores + 1 campo de texto editável por componente.

## Alterações

### `src/components/postagens/TaxacaoConfig.tsx`
1. Adicionar os 5 novos campos de cor + `mensagem_site` ao `TaxacaoSettings` e `DEFAULT_SETTINGS`
2. Substituir `MENSAGEM_FIXA_SITE` por `settings.mensagem_site` no preview
3. Aplicar as cores dinâmicas no `TaxacaoTrackingPreview` e `buildTaxacaoPreviewHtml`:
   - `cor_titulo_resumo` no h3 "Resumo da Cobrança"
   - `cor_label_taxa` no "Total a pagar"
   - `cor_descricao` no texto da mensagem
   - `cor_fundo_descricao` e `cor_borda_descricao` no container
4. Adicionar grid de color pickers na seção de configuração (expandir o grid existente de 2 para ~4 colunas)
5. Adicionar textarea para `mensagem_site`
6. Incluir na serialização `corpo_email` (tags `{{taxacao_cor_titulo_resumo:...}}` etc.)

### `src/components/postagens/FailedDeliveryConfig.tsx`
1. Mesmos 5 campos + `mensagem_site` ao `FalhaEntregaSettings`
2. Aplicar cores no `FalhaEntregaTrackingPreview` e `FalhaEntregaEmailPreview`
3. Adicionar color pickers + textarea para mensagem do site
4. Incluir na serialização do `localStorage` (e no save para `postagem_config`)

### Persistência
- Taxação: serializado nas tags `{{taxacao_*}}` dentro do `corpo_email` (padrão existente)
- Falha: serializado no `localStorage` + campos existentes no `postagem_config` (padrão existente)
- Sem migration necessária

### Layout dos color pickers
Organizar em um card "Personalização de Cores" com grid 2x3 ou 3x2 para não poluir a UI existente. Cada picker = input color + campo hex.

