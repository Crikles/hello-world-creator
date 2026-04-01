

## Plan: Adicionar aba "Tutorial" na página de Recuperação de Vendas

### O que será feito

Adicionar uma nova aba "Tutorial" no componente principal `RecuperacaoVendas`, contendo um guia visual e completo explicando como o sistema funciona. O tutorial cobrirá:

1. **O que é a Recuperação de Vendas** — explicação geral do conceito (carrinho abandonado + PIX pendente)
2. **Como funciona o fluxo** — diagrama em steps: checkout detecta evento → webhook captura lead → sistema aguarda delay → dispara e-mail e/ou SMS → cliente volta e finaliza
3. **Checkouts compatíveis** — lista dos checkouts que já têm integração nativa (Vega, Zedy, Luna, Corvex, Adoorei, Shopify) + menção ao webhook genérico
4. **Como configurar** — passo a passo: ativar o toggle, personalizar e-mail, configurar SMS, definir delay
5. **Webhook genérico** — explicação de como usar o endpoint `webhook-recovery?token=...&tipo=...` para checkouts não integrados nativamente
6. **Variáveis disponíveis** — tabela com `{{nome_cliente}}`, `{{lista_produtos}}`, `{{valor_total}}`, `{{link_checkout}}`, `{nome}`, `{produto}`, `{link}` (SMS)
7. **Regras do SMS** — resumo das restrições (160 chars, sem acentos, sem emojis)
8. **Deduplicação** — explicação que o sistema não envia duplicatas nas últimas 24h

### Alteração

Arquivo: `src/pages/RecuperacaoVendas.tsx`

- Adicionar nova `TabsTrigger` "Tutorial" com ícone `BookOpen` (de lucide-react)
- Criar componente `TutorialTab` inline com cards estilizados usando o mesmo design system (glass, glow-border)
- Cada seção será um card colapsável ou fixo com ícones e texto claro
- Incluir o webhook URL dinâmico do usuário como exemplo copiável

