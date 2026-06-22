## Objetivo

Ajustar os e-mails globais (internacionais) em dois pontos:

1. **E-mail de Confirmação de Pagamento** mostra `R$` mas deve mostrar **USD ($)** no fluxo em inglês e **EUR (€)** no fluxo em espanhol.
2. **E-mails do fluxo (steps 1–10)** hoje **não exibem nome do produto** e **não exibem valor**. Vamos:
   - Incluir o **nome do produto** apenas no **primeiro e-mail** (step 1 – "Order received / Pedido Recibido").
   - **Não exibir o valor** em nenhum e-mail de fluxo (continua zero menções a preço).
   - Confirmação de pagamento continua mostrando produto + valor (com moeda correta).

## Regra de moeda (fluxo global)

| Idioma global | Moeda | Formato exibido |
| --- | --- | --- |
| `en` (inglês) | USD | `$199.90` |
| `es` (espanhol) | EUR | `€199,90` |
| `pt` (fallback) | BRL | `R$ 199,90` |

A moeda é derivada de `envios.global_flow_lang` (ou `global_flow_config.idioma`). **Não precisa migração de banco** para essa etapa — derivamos da linguagem já existente. Se mais à frente você quiser um seletor de moeda independente, é só pedir.

## Arquivos a alterar

### 1. `supabase/functions/_shared/global-confirm-email.ts`
- Adicionar helper `formatCurrency(value, lang)` com os símbolos acima.
- Substituir o `R$ ${vars.valor}` (linha 194) por `formatCurrency(...)` baseado no `lang` recebido.

### 2. `supabase/functions/send-payment-confirmation/index.ts`
- Passar o `valor` como número cru para o template (em vez de pré-formatado em vírgula).
- Garantir que o `lang` é repassado ao renderer (já está).

### 3. `supabase/functions/send-global-flow/templates.ts`
- Adicionar campo opcional `product?: string` ao tipo `EmailContent`.
- Em `EMAIL_EN[1]` e `EMAIL_ES[1]` (step 1), preencher `product: c.produto`.
- Demais steps continuam sem produto/valor.

### 4. `supabase/functions/send-global-flow/index.ts` + `buildEmailHtml`
- Passar `produto` para os templates (vem do `envio.produto`, parseado).
- No HTML do e-mail (`buildEmailHtml`), se `content.product` existir, renderizar **apenas o nome** numa linha simples acima do corpo (sem tabela de valor, sem preço). Exemplo:

  ```
  📦 Product: Wireless Earbuds Pro
  ```

- **Nenhum** e-mail de fluxo passa a mostrar valor monetário.

## O que NÃO muda

- Painel/listagem de envios continua em `R$` (esse pedido foi adiado).
- E-mails domésticos (Postagens normais) continuam iguais.
- SMS e WhatsApp do fluxo global continuam sem produto/valor (já estão assim).
- Templates customizáveis do banco (`confirm_email_template_en/es`) continuam funcionando — só a substituição de `{{valor}}` passará a usar a moeda correta no fallback; se o usuário tiver colocado "R$" manualmente no template custom, ele permanece (não vamos rescrever conteúdo do usuário).

## Resultado esperado

- E-mail de confirmação (es): `Valor — €199,90`
- E-mail de confirmação (en): `Value — $199.90`
- E-mail step 1 (en): inclui linha `Product: Wireless Earbuds Pro`, sem preço.
- E-mails steps 2–10: sem produto, sem preço (como hoje).
