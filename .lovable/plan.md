

## Plan: Deploy da edge function webhook-corvex

### Problema

A edge function `webhook-corvex` **não está deployada**. Os logs mostram `404` com `function_id: nil` quando o webhook é chamado. Isso significa que a Corvex está enviando o evento, mas o servidor retorna 404 e nada acontece.

A última edição no código (mudança do `isPendingEvent`) não foi acompanhada de um deploy efetivo.

### O que será feito

1. **Deploy da `webhook-corvex`** — Usar a ferramenta de deploy para publicar a edge function com o código atualizado que já contém a correção `const isPendingEvent = status === "pending"`

2. **Testar via curl** — Após o deploy, enviar um POST de teste simulando um evento Corvex com `status: "pending"` e `method: "pix"` usando o token da loja `d0dea10f2cd8`, para confirmar que o lead é criado e os disparos de email/SMS são invocados

### Problema adicional detectado

A `webhook-vega` está com erro de boot (`Identifier 'isAbandonedCart' has already been declared`). Isso é um bug separado que precisa ser corrigido em outro momento.

### Arquivo

- `supabase/functions/webhook-corvex/index.ts` — apenas deploy, sem alteração de código

