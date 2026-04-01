
## Plan: Mostrar variáveis disponíveis e URL do CTA na configuração de email

### O que será feito

Na seção de configuração do email (dentro do `TabsContent value="config"`), adicionar dois elementos:

1. **Card de Variáveis Disponíveis** — logo após o card "Configuração Geral" (assunto/delay/cores), um card compacto listando as variáveis que o usuário pode usar no assunto e nos textos:
   - `{{nome_cliente}}` — Nome do cliente
   - `{{lista_produtos}}` — Lista de produtos do pedido
   - `{{valor_total}}` — Valor total do pedido
   - `{{link_checkout}}` — Link do checkout/pagamento
   - `{{nome_produto_principal}}` — Nome do primeiro produto
   - `{{codigo_cupom}}` — Código do cupom configurado
   - Cada variável será um chip clicável que copia para o clipboard

2. **URL do CTA no bloco "Botão (CTA)"** — dentro do `SectionToggle` do botão CTA (linha ~530), adicionar:
   - Um campo de input editável para URL personalizada (novo campo `url_cta` no settings)
   - Um texto informativo: "Por padrão, o botão direciona para a URL do checkout abandonado/PIX gerado capturada automaticamente. Altere apenas se quiser redirecionar para outro link."
   - Se o campo estiver vazio, mostrar um badge "Automático" indicando que usará `{{link_checkout}}`

### Alterações

**Arquivo: `src/pages/RecuperacaoVendas.tsx`**

- Adicionar interface `RecoverySettings` com novo campo opcional `url_cta: string`
- Nos DEFAULTS, `url_cta: ""` (vazio = automático)
- Inserir card de variáveis entre o card "Configuração Geral" e a SectionToggle "Saudação" (~linha 484)
- No SectionToggle "Botão (CTA)" (~linha 530), adicionar input de URL + info text
- Na função `buildEmailHtml`, usar `url_cta` se preenchido, senão `{{link_checkout}}`
- Persistir `url_cta` como tag de metadado `{{recovery_url_cta:valor}}` no corpo_email (mesmo padrão existente)

**Arquivo: `supabase/functions/send-recovery-email/index.ts`**

- No `parseSettings`, extrair tag `recovery_url_cta`
- No `buildEmailHtml`, se `url_cta` estiver definido, usar no lugar de `vars.link_checkout`

### Detalhes técnicos

- As variáveis são renderizadas como chips com ícone de copy, usando o mesmo estilo glass do resto da página
- O campo `url_cta` segue o padrão de metadata tags `{{recovery_url_cta:...}}` já usado para cores e toggles
- No backend, a prioridade é: `url_cta` (se preenchido) > `vars.link_checkout` (URL capturada do webhook)
