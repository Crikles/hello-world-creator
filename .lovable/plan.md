

## Objetivo
Na aba **Enviados** do painel WhatsApp, exibir qual instância foi usada para enviar cada mensagem, mostrando o **label** (nomenclatura customizada pelo usuário, ex: "14 pro+ Wpp N") ou, na falta dele, o `instance_name`.

## Contexto

A tabela `whatsapp_send_queue` já possui a coluna `instance_id` (uuid, nullable). A `advance-shipments` preenche esse campo quando dispara a mensagem (preciso verificar — se não preencher, ajusto a edge function).

A tabela `whatsapp_instances` tem as colunas `label` (nomenclatura customizada) e `instance_name` (fallback).

## Plano

### 1. Verificar/garantir que `instance_id` é gravado no envio
- Conferir `supabase/functions/advance-shipments/index.ts` (e o processador da fila WhatsApp) para garantir que, ao mudar status para `sent`, salva o `instance_id` da instância usada.
- Se não estiver salvando, adicionar `instance_id: <id usado>` no UPDATE.

### 2. Atualizar query da aba "Enviados" em `src/pages/WhatsApp.tsx`
- Incluir join com `whatsapp_instances` no select da query de itens enviados:
  ```ts
  .select("id, ..., instance_id, instance:instance_id(label, instance_name)")
  ```

### 3. Renderizar a coluna/badge da instância
- No card de cada item da aba Enviados, adicionar um badge discreto (ao lado do horário ou do código de rastreio) com:
  - `instance.label || instance.instance_name || "—"`
- Estilo: badge sutil, cor secundária, com ícone `Smartphone` para identificação visual.

### 4. Edge cases
- Se `instance_id` for null (envios antigos antes desta mudança), exibir "—" ou esconder o badge.
- Truncar nomes longos no UI com `max-w` + `truncate`.

## Arquivos afetados
- `src/pages/WhatsApp.tsx` — query + render do badge.
- `supabase/functions/advance-shipments/index.ts` — só se confirmar que `instance_id` não está sendo gravado hoje.

## Sem mudanças de schema
Coluna `instance_id` já existe na `whatsapp_send_queue`.

