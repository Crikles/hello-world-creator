
## Plano: Corrigir SMS sem link + redeployar functions pendentes

### Diagnóstico

O lead mais recente (12:20) mostra:
- `checkout_url`: vazio
- `total_value`: 500 (deveria ser 5)
- `pix_code`: vazio
- Porém `raw_payload.order_url` = `https://checkout.formulariobr.com/order/VCP1O8W9X62`

O log `[webhook-vega] Recovery data:` (que deveria existir no código novo) **não aparece nos logs**. Isso confirma que a function `webhook-vega` com as correções de valor, checkout_url e PIX **ainda não foi deployada com sucesso**.

O SMS usa `lead.checkout_url` para substituir `{link}` no template. Como o lead foi salvo com `checkout_url` vazio, o SMS sai sem link.

### Ação

1. **Forçar redeploy** das functions `webhook-vega` e `send-recovery-email` usando a ferramenta de deploy
2. **Verificar nos logs** que o deploy foi bem sucedido e que o novo código está ativo
3. Pedir ao usuário que gere um novo PIX para testar

Não há alterações de código necessárias — o código fonte já está correto. O problema é exclusivamente de deploy.
