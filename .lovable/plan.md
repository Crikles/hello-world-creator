

## Refatorar Confirmação de Pagamento: Editor Visual + Preview + Email Remetente

### Problema Atual
A página usa um `Textarea` para editar HTML bruto, sem preview do email. O usuário não consegue visualizar como o email ficará.

### Solução

Reescrever a aba "Configuração" da página `ConfirmacaoPagamento.tsx` seguindo o padrão da RecuperacaoVendas:

**1. Editor visual com seções toggleáveis (lado esquerdo)**

Campos editáveis por seção (sem HTML):
- **Saudação** — texto customizável (ex: "Olá {{nome}}, seu pagamento foi confirmado!")
- **Resumo do Pedido** — toggle para mostrar produto + valor
- **Mensagem Principal** — textarea para texto livre
- **Botão CTA** — texto + URL customizáveis
- **Rodapé** — texto final
- **Cores** — color pickers para título, texto, destaque, botão
- **Email Remetente (FROM)** — campo de input para o usuário definir o nome remetente (ex: "Minha Loja")

**2. Preview em tempo real (lado direito)**

- Iframe com o HTML renderizado, igual à RecuperacaoVendas
- Atualiza ao vivo conforme o usuário edita
- Barra simulando cliente de email (dots vermelha/amarela/verde + assunto + destinatário)

**3. Serialização no `corpo_email`**

Usar o mesmo padrão de metadata tags da RecuperacaoVendas para salvar as configurações no campo `corpo_email`:
```
{{conf_saudacao:texto}}{{conf_mostrar_resumo:true}}{{conf_mensagem:texto}}...
```

**4. Atualizar Edge Function**

O `send-payment-confirmation` precisa fazer o parse dessas tags e montar o HTML final (em vez de usar o corpo_email como HTML direto).

**5. Migração DB**

Adicionar coluna `email_remetente_nome` à tabela `confirmacao_pagamento_config` para o campo "from".

### Arquivos Modificados
- `src/pages/ConfirmacaoPagamento.tsx` — reescrita completa da aba config
- `supabase/functions/send-payment-confirmation/index.ts` — parse das tags + usar `email_remetente_nome`
- Nova migração SQL — adicionar coluna `email_remetente_nome`

