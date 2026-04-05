

## Diagnóstico: Duplicação e URL do CTA na Zedy

### 1. Sobre a "duplicação"

**Não é duplicação** — são dois pedidos diferentes:
- Lead 1 (13:24): orderId `Z-05QDM04FCA261556`
- Lead 2 (13:25): orderId `Z-05AGJ04JE7261556`

A Zedy enviou dois webhooks `waiting_payment` para dois PIX distintos que você gerou. Porém, o pedido `Z-05AGJ04JE7261556` foi enviado **duas vezes** pela Zedy (às 13:10 e às 13:24), o que poderia gerar leads duplicados do mesmo pedido. Precisamos adicionar deduplicação **por orderId** (não por email).

### 2. Problema real: URL do CTA está errada

A URL capturada do `actions[0].url` é:
```
https://app.zedy.com.br/admin/1556/salles/46382528
```

Isso é uma **URL do painel administrativo da Zedy**, não uma página de pagamento do cliente. O comprador que clicar nesse botão vai parar no admin da loja, não na página do PIX.

Como a Zedy **não fornece uma URL de checkout do cliente** no payload, o botão CTA não tem para onde apontar.

### Plano de correção

**1. `supabase/functions/webhook-zedy/index.ts`**
- Adicionar deduplicação **por orderId** (transaction token): antes de criar o lead, verificar se já existe um `recovery_lead` com o mesmo `orderId` no `raw_payload` para essa loja. Se existir, não criar outro.
- **Não salvar** `actions[0].url` como `checkout_url`, pois é URL admin. Deixar `checkout_url` vazio.

**2. `supabase/functions/send-recovery-email/index.ts`**
- Nenhuma alteração necessária. O CTA já é ocultado automaticamente quando `checkout_url` está vazio e `url_cta` da config também está vazio (linha 115: `if (ctaUrl && ctaUrl !== "#")`).

**3. Redeploy** da function `webhook-zedy`

### Resultado esperado
- Sem leads duplicados do mesmo pedido (deduplicação por orderId)
- Leads de pedidos diferentes continuam sendo criados normalmente
- Email da Zedy sai **sem botão CTA** (pois não há URL de pagamento do cliente)
- Se futuramente quiser adicionar um botão, pode configurar um `url_cta` fixo na config de recuperação

### Alternativa sobre o CTA
Se você tiver uma URL pública de checkout da Zedy (tipo `https://checkout.zedy.com.br/order/...`), me avise que eu configuro o mapeamento. Caso contrário, o email vai sem botão mesmo.

