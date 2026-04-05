

## Plano: Corrigir valor, QR Code, Copia e Cola e botão no email de recuperação

### Diagnóstico (dados reais do último teste)

Analisei o lead criado às 12:10 de hoje. O payload da Vega mostra:
- `status: "abandoned_cart"` (não `pending` com PIX)
- `total_price: 500` (centavos = R$5,00)
- Sem campos `pix_code` ou `pix_code_image64` no payload
- `abandoned_checkout_url_url` presente mas não foi salvo

**3 problemas identificados:**

1. **Valor R$500 em vez de R$5**: O código fonte tem `totalPrice / 100` mas a versão deployada não tem — os dados no banco mostram `total_value: 500` e `product.value: 0`. As functions precisam ser redeployadas.

2. **Sem QR Code/Copia e Cola**: A Vega enviou o evento como `abandoned_cart`, não como `pending` com método PIX. Eventos de carrinho abandonado da Vega **não incluem** campos `pix_code` nem `pix_code_image64`. Esses dados só existem quando a Vega envia um evento `status: pending` com `method: pix`.

3. **Sem botão CTA**: O `checkout_url` ficou vazio porque a versão deployada não tem o mapeamento de `abandoned_checkout_url_url`.

### Alterações

**1. `supabase/functions/webhook-vega/index.ts`**

- Melhorar a classificação: se `status === "abandoned_cart"` E `method` contém "pix", tratar como `pix_pendente` (não `carrinho`)
- Isso garante que carrinhos abandonados no momento do PIX sejam classificados corretamente

**2. Redeployar `webhook-vega` e `send-recovery-email`**

- As correções de valor (`totalPrice / 100`, product `value / 100`) e checkout_url já existem no código fonte mas a versão em produção está desatualizada
- O redeploy vai ativar todas as correções pendentes

### O que NÃO é possível resolver via código

O QR Code e Copia e Cola **dependem da Vega enviar esses dados no payload**. O evento `abandoned_cart` não os inclui. Para receber o QR Code, a Vega precisa enviar um evento `status: pending` com `method: pix` — esse evento contém `pix_code` e `pix_code_image64`. Verifique na configuração da Vega se os eventos de "PIX gerado/pendente" estão habilitados para o webhook.

### Resultado esperado após implementação
- Valor correto: R$5,00
- Botão CTA com link de recuperação funcionando
- Se a Vega enviar evento `pending` com PIX: QR Code + Copia e Cola no email
- Se enviar apenas `abandoned_cart`: email sem PIX mas com botão de checkout

