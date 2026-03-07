

## Plano: Melhorias na aba "Enviar" do WhatsApp

### Problemas identificados

1. **Moedas com arredondamento errado**: Linha 449 usa `.toFixed(0)` que arredonda 7.70 para 8. Precisa usar `.toFixed(2)` para mostrar o valor real.
2. **Filtro de status** usa status do envio (Pendente, Coletado...) mas deveria filtrar por "Enviado/Não Enviado" via WhatsApp.
3. **Sem persistência** de quais mensagens já foram enviadas — atualmente é só estado local (`sentIds`).
4. **Sem automação** de envio para novos leads.
5. **Sem rotação** de instâncias.

### Alterações

#### 1. Database Migration
- Criar tabela `whatsapp_message_log` para persistir envios:
  - `id`, `envio_id`, `loja_id`, `instance_id`, `status` (sent/failed), `created_at`
- Adicionar colunas em `postagem_config`:
  - `whatsapp_auto_send BOOLEAN DEFAULT false`
  - `whatsapp_delay_seconds INTEGER DEFAULT 300` (5 min)
- RLS: `user_owns_loja` para acesso

#### 2. Edge Function `send-whatsapp`
- Nova action `send-queue`: recebe lista de envio IDs, aplica delay entre envios, faz rotação de instâncias (round-robin entre todas as instâncias ativas da loja com assinatura válida)
- Registrar cada envio na `whatsapp_message_log`
- Action `send` também registra no log

#### 3. Frontend `src/pages/WhatsApp.tsx`
- **Corrigir moedas**: `.toFixed(0)` → `.toFixed(2)` na exibição do saldo
- **Filtro**: Trocar filtro de status do envio por "Todos", "Enviado", "Não Enviado" baseado na tabela `whatsapp_message_log`
- **Toggle Automático**: Switch para ativar `whatsapp_auto_send` com campo de delay em minutos
- **Rotação**: Buscar todas as instâncias da loja (permitir múltiplas), exibir indicador de rotação no envio em massa
- Carregar `whatsapp_message_log` para marcar visualmente quais envios já foram enviados (persistente, não apenas local state)

#### 4. Suporte a múltiplas instâncias
- Remover constraint `UNIQUE(loja_id)` de `whatsapp_instances` (atualmente upsert com `onConflict: "loja_id"`)
- Atualizar edge function `init` para não usar upsert — usar insert simples
- Na UI de instância, listar todas as instâncias da loja
- Na rotação: intercalar mensagens entre instâncias conectadas com assinatura ativa

### Arquivos alterados
- `src/pages/WhatsApp.tsx` — filtro, auto-send, delay, rotação, fix moedas
- `supabase/functions/send-whatsapp/index.ts` — log de mensagens, rotação
- Migration SQL — `whatsapp_message_log`, colunas em `postagem_config`, remover unique constraint

### Detalhes técnicos

```text
Rotação round-robin:
  Instâncias ativas: [A, B, C]
  Envios: [1, 2, 3, 4, 5]
  → Envio 1 → Instância A
  → Envio 2 → Instância B
  → Envio 3 → Instância C
  → Envio 4 → Instância A
  → Envio 5 → Instância B
```

Auto-send: Quando ativado, a edge function `advance-shipments` (ou um cron job) verificará novos envios sem registro em `whatsapp_message_log` e os enviará automaticamente com o delay configurado.

