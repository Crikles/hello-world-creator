

# Personalização de Cor de Destaque — Taxação e Falha na Entrega

## Problema atual

Ambos os componentes possuem apenas **cor do botão** customizável. Os demais elementos de destaque (referência, status, badge "AÇÃO REQUERIDA", seletor PIX, aba ativa na timeline) usam cores fixas hardcoded (`#6366f1` na Taxação, `#ea580c` na Falha).

## O que será feito

Adicionar um campo **"Cor de Destaque"** (`cor_destaque`) em ambos os configs, que controla todos os elementos de acento:

| Elemento afetado | Taxação | Falha na Entrega |
|---|---|---|
| Código de referência (font color) | ✅ | ✅ |
| Status / CPF text | ✅ | ✅ |
| Badge "AÇÃO REQUERIDA" (text + bg) | ✅ | ✅ |
| Tab ativa na timeline (dot + text) | ✅ | ✅ |
| Seletor PIX (border + icon) | ✅ | — |
| Barra decorativa no email | ✅ | — |
| "Ação Necessária" no email | — | ✅ |

O botão CTA continua usando `cor_botao` separadamente.

## Alterações por arquivo

### `src/components/postagens/TaxacaoConfig.tsx`
1. Adicionar `cor_destaque` ao `TaxacaoSettings` (default: `#6366f1`)
2. Substituir todos os `#6366f1` hardcoded no `TaxacaoTrackingPreview` por `settings.cor_destaque`
3. Substituir `#6366f1` no `buildTaxacaoPreviewHtml` (email) por `settings.cor_destaque`
4. Adicionar color picker "Cor de Destaque" ao lado do "Cor do Botão"
5. Incluir `cor_destaque` na serialização/parsing do `corpo_email` (tag `{{taxacao_cor_destaque:...}}`)

### `src/components/postagens/FailedDeliveryConfig.tsx`
1. Adicionar `cor_destaque` ao `FalhaEntregaSettings` (default: `#ea580c`)
2. Substituir todos os `#ea580c` hardcoded no `FalhaEntregaTrackingPreview` por `settings.cor_destaque`
3. Substituir `#ea580c` no `FalhaEntregaEmailPreview` por `settings.cor_destaque`
4. Adicionar color picker "Cor de Destaque" ao lado do "Cor do Botão"
5. Incluir `cor_destaque` na serialização/parsing (tag `{{falha_cor_destaque:...}}`)

### Persistência
Os dados já são salvos via `localStorage` + `corpo_email` no banco. Apenas adicionamos mais uma tag de metadata ao `corpo_email`, seguindo o padrão existente. Sem migration necessária.

