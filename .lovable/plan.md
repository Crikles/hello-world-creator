# Reformatar e-mails de Taxação e Falha na Entrega

## Objetivo
Deixar os e-mails de **Taxação** e **Falha na Entrega** com o mesmo visual do preview de e-mail mostrado no painel (imagem com ícone, badge "Ação Necessária", mensagem e box destacado com a taxa) e garantir que o botão de CTA leve o cliente para a URL definida no campo **Link de Checkout** do template correspondente.

## Mudanças

### 1. Botão de CTA → Link de Checkout do template
Arquivo: `supabase/functions/send-email/index.ts`

- **Taxação** (`buildTaxacaoEmailHtml`): hoje o botão aponta para `${appBaseUrl}?p=${envioId}` (página de rastreio). Trocar para `tax.url_pagamento` (já capturado em `parseTaxacaoSettings` via `{{taxacao_url:...}}`). Fallback para a página de rastreio se vazio.
- **Falha na Entrega** (`buildFalhaEntregaEmailHtml`): já usa `config.checkout_url_falha`. Manter — só revisar fallback.

A página pública de rastreio (a ser configurada depois) continuará exibindo seu próprio botão apontando para essa mesma URL — sem alterações de código agora.

### 2. Novo layout dos dois e-mails (estilo do preview)
Reescrever o HTML de `buildTaxacaoEmailHtml` e `buildFalhaEntregaEmailHtml` para seguir o layout de `image-13`:

```text
┌─────────────────────────────────────┐
│         [logo redondo / ícone]      │
│                                     │
│         Falha na Entrega            │  ← título grande
│         Ação Necessária             │  ← subtítulo em cor de destaque
│                                     │
│  Olá {{cliente_primeiro_nome}},     │
│                                     │
│  Tivemos um problema ao entregar    │
│  o seu pedido **{{produto}}**.      │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ mensagem editável (msg do   │    │  ← box destacado
│  │ template, fundo claro)      │    │
│  │                             │    │
│  │ TAXA DE REENVIO    R$ 0,00  │    │  ← linha de valor
│  └─────────────────────────────┘    │
│                                     │
│       [  PAGAR REENVIO →  ]         │  ← botão (cor do template)
│                                     │
│       [💬 Fale Com o Vendedor]      │  ← se whatsapp ativo
│                                     │
│  Atenciosamente, MAGNUS FRETE       │
└─────────────────────────────────────┘
```

Equivalente para Taxação: título "Taxa de Importação" / subtítulo "Pagamento Pendente", box com "VALOR DA TAXA R$ X,XX", botão com `tax.texto_botao`.

Detalhes do layout:
- Fundo do corpo: `#ffffff` (e-mail seguro).
- Card centralizado com `max-width: 560px`, cantos `border-radius: 20px`.
- Ícone/logo redondo no topo.
- Título em peso 800, subtítulo em cor de destaque (`tax.cor_botao` / `#ea580c` para falha).
- Mensagem editável renderizada com `replaceVariables(...)` — usuário continua editando pelo painel.
- Box destacado com borda da cor do template, fundo claro (`#fff7ed` para falha, `#fffbeb` para taxação), exibindo a mensagem editável + linha "TAXA …  R$ X,XX".
- Botão único de CTA logo abaixo do box, full-width-like, cor do template.
- Botão de WhatsApp permanece condicional (quando `whatsapp_vendedor` configurado).
- Remover blocos atuais de "Produto / Transportadora / Rastreio" desses dois templates para combinar com o preview limpo (esses dados continuam disponíveis na página pública de rastreio).
- Rodapé com "Atenciosamente, <Empresa>" + sub-rodapé "Enviado por … • Rastreio automático".

### 3. Preservar edição pelo usuário
- Continuar lendo a mensagem do campo do template (`tax.mensagem_taxa` / `config.msg_falha_entrega`).
- Continuar lendo valor, texto do botão e cores dos mesmos campos já existentes — nada de novo no schema.
- Variáveis `{{cliente_primeiro_nome}}`, `{{produto}}`, etc. seguem sendo substituídas.

## Fora do escopo
- Página pública de rastreio (será feita depois, conforme o usuário pediu).
- Mudanças no painel de configuração (campos já existem: Link de Checkout, Valor, Mensagem, Cores).
- Templates de e-mail diferentes de Taxação e Falha na Entrega.

## Validação
1. Enviar e-mail de teste de Taxação → conferir layout idêntico ao preview e botão apontando para o Link de Checkout configurado.
2. Enviar e-mail de teste de Falha na Entrega → idem.
3. Conferir que mensagem editada no painel aparece no box destacado.
