

# Adicionar Links Rápidos nos Cards de Envios

## O que será feito

Adicionar botões de ação rápida em cada card de envio na página de Envios, permitindo ao usuário:

1. **Ver Rastreio** -- Abre a página pública de rastreio (`/r/CODIGO`) em nova aba
2. **Ver Taxação** -- Visível apenas quando o status é "taxacao" ou "pagamento_confirmado", abre a página de pagamento (`/p/ENVIO_ID`) em nova aba
3. **Ver DANFE/NF** -- Visível apenas quando o envio possui `nfe_chave_acesso`, navega para gerar/visualizar a DANFE

## Alterações

### `src/pages/Envios.tsx`

- Importar ícones adicionais: `ExternalLink`, `FileText`, `CreditCard`
- No footer de cada card (linha ~395-426), adicionar uma row de botões de link rápido **sempre visíveis** (não apenas no hover):
  - Botão "Rastreio" com ícone `ExternalLink` -- usa `window.open` para abrir `/r/{codigo_rastreio}` em nova aba. Visível quando o envio tem `codigo_rastreio`
  - Botão "Taxação" com ícone `CreditCard` -- abre `/p/{envio.id}` em nova aba. Visível quando status é `taxacao` ou `pagamento_confirmado`
  - Botão "NF-e" com ícone `FileText` -- abre a DANFE. Visível quando `nfe_chave_acesso` existe

- Os botões terão estilo discreto (`variant="ghost"`, tamanho pequeno) com texto de 10px e ícones de 3.5

### Detalhes técnicos

Os links serão abertos com `window.open(url, '_blank')` para não perder o contexto da página de envios. A URL base para rastreio e pagamento será construída dinamicamente usando `window.location.origin` para funcionar em qualquer domínio.

Os botões de ação existentes (avançar, deletar) continuam no hover como estão. Os novos botões de link ficam sempre visíveis no footer do card.

