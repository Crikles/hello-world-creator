

## Plano: Corrigir link do CTA nos emails de recuperação (Corvex)

### Problema
O botão CTA nos emails de recuperação aponta para `#` (link quebrado) porque:
1. No `webhook-corvex`, o `checkoutUrl` é extraído de `payload.utm.page.url` — nos testes reais esse campo veio `null`, gerando string vazia
2. Na config de recuperação, `{{recovery_url_cta:}}` está vazio (o usuário não configurou URL de fallback)
3. No email, `s.url_cta || vars.link_checkout` resulta em `""`, que vira link quebrado

### Correção

**1. `supabase/functions/webhook-corvex/index.ts`** (linha ~235)
- Pela documentação da Corvex, o campo correto é `payload.utm.page.url` (URL do checkout)
- Adicionar fallback: se `utm.page.url` não existir, tentar construir URL com o ID do pedido a partir de `payload.checkout_query_params` ou deixar vazio
- O código atual já faz `payload.utm?.page?.url || payload.checkout_url || ""` — está correto, o problema é que o payload real não trouxe UTM

**2. `supabase/functions/send-recovery-email/index.ts`** (linhas 98-105)
- Se `ctaUrl` estiver vazio, **ocultar o botão CTA** inteiramente em vez de mostrar botão com `href="#"`
- Isso evita que o cliente receba email com botão que não funciona

**3. Orientação ao usuário**
- Informar que é necessário configurar a "URL do CTA" na tela de Recuperação de Vendas com o link do checkout da loja (ex: `https://sualoja.corvex.com.br/checkout/...`)
- A Corvex envia o campo `utm.page.url` apenas quando o cliente acessa via link com UTM — não é garantido em todos os eventos

### Arquivos
- `supabase/functions/send-recovery-email/index.ts` — ocultar CTA quando URL vazia
- `supabase/functions/webhook-corvex/index.ts` — sem mudança necessária (mapeamento já está correto pela doc)

