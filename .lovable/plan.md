

## Plano: Só enfileirar WhatsApp se houver instância conectada

### Mudança
No `auto-whatsapp-new-order/index.ts`, após validar `whatsapp_auto_send = true` e antes de inserir na fila, adicionar uma checagem na tabela `whatsapp_instances`:

```ts
const { data: connectedInst } = await supabase
  .from("whatsapp_instances")
  .select("id")
  .eq("loja_id", loja_id)
  .eq("status", "connected")
  .gt("expires_at", new Date().toISOString())
  .limit(1)
  .maybeSingle();

if (!connectedInst) {
  return new Response(JSON.stringify({
    success: true, skipped: true, reason: "no_connected_instance"
  }), { status: 200 });
}
```

### Comportamento resultante
- **Com instância conectada + auto ON** → enfileira normalmente (como hoje)
- **Sem instância conectada** → ignora silenciosamente, lead NÃO entra na fila
- **Auto OFF** → continua ignorando (comportamento atual)

### Benefícios
- Fila não acumula mensagens que nunca poderão ser enviadas
- Sistema não pesa com pendentes "fantasmas"
- Quando o usuário conectar a instância depois, novos pedidos passam a entrar na fila automaticamente
- Pedidos antigos (sem WhatsApp na chegada) ficam disponíveis para envio manual via "Enviar Todos" na página WhatsApp

### Sem alterações em outras funções
- `send-whatsapp` (envio manual) já valida instância antes de enfileirar
- `advance-shipments` continua processando normalmente

### Deploy
- Redeploy de `auto-whatsapp-new-order`

