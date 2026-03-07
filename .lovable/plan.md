

# Análise: Rotação de Instâncias e Envio Automático em Background

## Status Atual

### Rotação de Instâncias — FUNCIONANDO
A rotação round-robin já está implementada no `send-queue` (linha 583 do `send-whatsapp/index.ts`):
```text
const inst = activeInstances[i % activeInstances.length];
```
Quando o usuário seleciona "Todas (rotação automática)" e envia em massa, cada mensagem vai para uma instância diferente, alternando entre as conectadas.

### Envio Automático com PC Desligado — NÃO FUNCIONA HOJE
O `whatsapp_auto_send` é salvo no banco, mas **nenhum processo server-side o consome**. O envio automático de WhatsApp depende da página estar aberta no navegador. A cron `advance-shipments` (roda a cada 5 min) já envia **email** e **SMS** automaticamente, mas **não envia WhatsApp**.

---

## Plano de Implementação

### Adicionar envio de WhatsApp ao `advance-shipments`

Na função `advanceShipment` (já existente no cron), após o bloco de envio de SMS (linha ~634), adicionar lógica para:

1. Verificar se `whatsapp_auto_send` está ativo na `postagem_config`
2. Verificar se o envio tem `cliente_telefone`
3. Buscar todas as instâncias conectadas e com assinatura ativa da loja
4. Usar rotação round-robin (baseada no `envio_id` hash ou contagem de mensagens) para escolher a instância
5. Montar o payload usando os campos de template da `postagem_config` (`whatsapp_msg_template`, `whatsapp_btn_text`, `whatsapp_footer`, etc.)
6. Enviar via UAZAPI diretamente (sem chamar a edge function `send-whatsapp`, para evitar overhead)
7. Registrar no `whatsapp_message_log`

### Rotação Inteligente no Cron
Para garantir distribuição uniforme entre instâncias no cron (que processa envios sequencialmente), manter um **contador local** na execução do cron que incrementa a cada envio por loja, usando `counter % activeInstances.length`.

### Arquivo Modificado
- `supabase/functions/advance-shipments/index.ts` — adicionar bloco de envio WhatsApp após o bloco de SMS, com rotação round-robin

### Sem mudanças no frontend
A configuração `whatsapp_auto_send` já é salva pelo frontend. Apenas o backend precisa consumi-la.

