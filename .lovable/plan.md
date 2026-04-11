

## Correção: Duplicação de Envios no Webhook Zedy (Race Condition)

### Diagnóstico

O Zedy envia **múltiplos webhooks `paid` simultâneos** para o mesmo pedido (confirmado: 3 webhooks no mesmo segundo para o orderId `Z-10SO904US22613008`). 

O código atual faz:
1. Busca pedido existente → vê que `envio_id` é null
2. Cria envio
3. Atualiza pedido com `envio_id`

Quando 3 requests chegam ao mesmo tempo, todas passam pelo passo 1 antes que qualquer uma complete o passo 3, gerando **3 envios duplicados**.

Identificamos **12 casos de duplicação** nos últimos 7 dias nesta loja.

### Solução

**1. Adicionar proteção contra race condition no `webhook-zedy/index.ts`**

Após criar o envio e linkar ao pedido, **re-verificar** se o pedido já tem envio antes de prosseguir. Usar uma abordagem de "check-then-act" com update condicional:

```typescript
// Substituir o insert direto por um update condicional:
// Só vincula o envio se o pedido AINDA não tem envio_id
const { data: updateResult } = await supabase
  .from("pedidos")
  .update({ envio_id: newEnvio.id })
  .eq("id", pedidoId)
  .is("envio_id", null)  // ← só atualiza se ainda for null
  .select("id")
  .maybeSingle();

// Se não atualizou (outra request já vinculou), deletar o envio duplicado
if (!updateResult) {
  await supabase.from("envios").delete().eq("id", newEnvio.id);
}
```

**2. Limpar os envios duplicados existentes desta loja**

Criar uma query para identificar e remover os envios órfãos (que não estão linkados a nenhum pedido).

**3. Aplicar a mesma correção nos outros webhooks** (Luna, Vega, Corvex, etc.) para prevenção.

### Resultado
- Webhooks simultâneos do Zedy não criam mais envios duplicados
- Os envios duplicados existentes serão removidos
- Proteção preventiva nos demais webhooks

