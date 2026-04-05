

## Diagnóstico: PIX Corvex não chega no painel de Recuperação

### O que foi investigado

1. **Edge function `webhook-corvex`**: Está ativa e respondendo corretamente (testei agora)
2. **Código de recuperação**: Correto — quando um evento `pending` chega, o lead é criado (existem 7 leads de teste do dia 01-02/abril funcionando)
3. **Configuração `recovery_config`**: Ativa para `pix_pendente` e `carrinho` nesta loja
4. **Frontend (RecuperacaoVendas)**: Query correta buscando por `loja_id` + `tipo`
5. **Separação**: O bloco de recuperação (try-catch isolado) NÃO interfere no fluxo de envios/postagens

### Problema encontrado

**Nenhum webhook da Corvex chegou para esta loja desde 02/abril.** O último evento recebido foi um teste manual. Os eventos `corvex.order.paid` que aparecem nos logs recentes (03-05/abril) pertencem a outra loja (`guiina.pintor@gmail.com`), não à sua.

Isso significa que **a Corvex não está enviando o webhook** `corvex.order.created` / `corvex.order.pending` para a URL configurada com o token `d0dea10f2cd8`.

### Causa provável

No painel da Corvex, a configuração de webhook pode estar:
- Com apenas o evento `corvex.order.paid` habilitado (sem `corvex.order.created` e `corvex.order.pending`)
- Com a URL incorreta ou desatualizada

A URL correta do webhook deve ser:
```
https://jnzamnnvzdecnnvvhzxn.supabase.co/functions/v1/webhook-corvex?token=d0dea10f2cd8
```

E os eventos habilitados devem incluir: **corvex.order.created**, **corvex.order.pending** e **corvex.order.paid**.

### Ação necessária

Verificar no painel da Corvex se os eventos `corvex.order.created` e `corvex.order.pending` estão habilitados no webhook. Sem isso, nosso sistema nunca recebe a notificação de PIX gerado.

### Melhorias no código (para robustez)

Embora o código já funcione quando o webhook chega, posso adicionar:

1. **Log de diagnóstico no início da função**: Registrar todas as requisições recebidas (incluindo as com token inválido) para facilitar debugging futuro
2. **Endpoint de teste**: Permitir validar se a URL está correta sem precisar gerar um PIX real

Porém, nenhuma alteração de código resolverá o problema atual — a Corvex precisa estar configurada para enviar os eventos pendentes.

