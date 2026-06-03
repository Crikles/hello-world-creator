## Mudanças solicitadas

### 1) E-mail "Saiu para Entrega" — remover "1ª tentativa"

Atualmente o corpo do e-mail vem da seed `postagem_eventos.corpo_email` e contém textos como "Seu pedido **{{produto}}** saiu para a 1ª tentativa de entrega hoje. Fique atento!". Trocaremos para o texto simples solicitado:

- **Novo texto padrão:** `Seu pedido **{{produto}}** saiu para entrega hoje.`
- Atualizar a seed em `src/components/postagens/emailTemplates.ts` (template "Saiu para Entrega").
- Atualizar via migration todas as linhas existentes em `postagem_eventos` cujo `status_label = 'Saiu para Entrega'` substituindo trechos com "1ª tentativa".

### 2) E-mail de "Falha na Entrega" e "Taxação" — passar a usar o template configurado em Postagens

Hoje em `send-email/index.ts` o layout especializado (`buildFalhaEntregaEmailHtml` / `buildTaxacaoEmailHtml`) só é acionado quando o `corpo_email` contém marcadores `{{falha_*}}` / `{{taxacao_*}}`. Como a maioria dos eventos não tem esses marcadores, o cliente recebe um e-mail genérico (foto do print).

Vamos alterar `buildEmailHtml` para que, sempre que `status_label === 'Falha Entrega'` ou `status_label === 'Taxação'`, o e-mail seja construído com `buildFalhaEntregaEmailHtml` / `buildTaxacaoEmailHtml` usando os dados configurados em **Postagens → Falha na Entrega** e **Postagens → Taxação** (`postagem_config.msg_falha_entrega`, `valor_taxa_falha`, `checkout_url_falha`, cores, etc.) e os campos correspondentes para taxação (`postagem_falha_config` / `postagem_taxacao_config`, conforme a tabela já lida pelas funções `falha-info` e `taxacao-info`).

- O parser de marcadores continua existindo como fallback (caso a loja tenha customizado o corpo com `{{falha_*}}`).
- O texto do corpo (`p.mensagem`) passa a vir de `postagem_config.msg_falha_entrega` (ou do equivalente para taxação) — exatamente o que o usuário edita na aba.
- O botão `botaoTexto` usa `tax.texto_botao` (Taxação) e um novo campo `texto_botao_falha` para falha (default "PAGAR REENVIO"), e o `botaoUrl` usa `https://atlas-cargo.org/f/<envio_id>` para falha e `https://atlas-cargo.org/p/<envio_id>` para taxação — assim o lead cai na página `PagamentoFalha`/`PagamentoTaxa` que já renderiza todas as personalizações configuradas.

### 3) Site de rastreio (Atlas) — botão "PAGAR REENVIO" clicável

No `src/pages/Rastreio.tsx`, os três layouts (Vetor, Jadlog, Atlas) já têm um `<a>` para `/f/<id>` e `/p/<id>` dentro do evento. Vamos garantir que:

- O botão sempre apareça abaixo da descrição do evento "Falha Entrega" / "Taxação" no layout Atlas (o atual usa estilo inline pequeno; vamos transformá-lo em um botão mais visível com cor de destaque do tema).
- O texto do botão será **PAGAR REENVIO** (falha) e **PAGAR TAXA** (taxação), com seta `→`.
- O destino continua sendo `/f/<envio.id>` e `/p/<envio.id>` (mesma origem, sem cross-domain), garantindo que a página `PagamentoFalha`/`PagamentoTaxa` mostre as personalizações da aba Postagens.

### Resultado esperado

- E-mails de "Saiu para Entrega" sem menção a "1ª tentativa".
- E-mails de "Falha na Entrega" e "Taxação" idênticos ao preview exibido na aba Postagens (mensagem, valor, cor, botão configurado).
- Clique no botão do site de rastreio leva direto para a página de pagamento personalizada.

### Arquivos afetados

- `src/components/postagens/emailTemplates.ts` — atualizar seed do "Saiu para Entrega".
- Migration SQL — atualizar `postagem_eventos` existentes (remover "1ª tentativa").
- `supabase/functions/send-email/index.ts` — forçar uso de `buildFalhaEntregaEmailHtml` / `buildTaxacaoEmailHtml` quando `status_label` casar; alimentar com `postagem_config`/`postagem_falha_config`/`postagem_taxacao_config`; gerar URLs absolutas `atlas-cargo.org/f|p/<id>`.
- `src/pages/Rastreio.tsx` — botão "PAGAR REENVIO" / "PAGAR TAXA" estilizado e visível no layout Atlas.

### Pendência de confirmação

Antes de implementar, preciso confirmar um ponto: para o item 2, devo manter compatibilidade quando a loja já tenha um corpo de e-mail customizado com texto livre (sem marcadores `{{falha_*}}`)? Minha proposta é **ignorar** o corpo_email do evento para Falha/Taxação e usar sempre o que está na aba Postagens — assim o e-mail bate com o preview que o usuário vê. Confirmar antes de prosseguir.
