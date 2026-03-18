

## Plano: Botão Admin para Reenviar Emails do Dia

### O que será feito
Adicionar uma nova Edge Function `resend-daily-emails` e um botão no `AdminDashboard` para reenviar todos os emails do dia com os links atualizados.

### Lógica da Edge Function (`supabase/functions/resend-daily-emails/index.ts`)
1. Autenticação dupla: JWT de admin ou service role
2. Busca todos os registros em `postagem_email_log` de hoje com `status = 'sent'`
3. Para cada registro (com `envio_id` e `evento_id`), chama internamente a função `send-email` passando `envio_id`, `evento_id`, `loja_id` (sem NF-e PDF para evitar reenvio de anexos pesados)
4. Processa sequencialmente com delay de 500ms entre envios para evitar rate limit do Resend
5. Retorna contagem de sucessos e falhas

### Alterações no Frontend (`src/pages/admin/AdminDashboard.tsx`)
1. Adicionar botão "Reenviar Emails de Hoje" com ícone de RefreshCw
2. Dialog de confirmação mostrando quantos emails serão reenviados
3. Progresso visual durante o reenvio
4. Toast de resultado com contagem de sucesso/falha

### Detalhes técnicos
- A Edge Function reutiliza `send-email` existente, que já usa o domínio atualizado
- Sem NF-e PDF no reenvio (somente email transacional com link de rastreio atualizado)
- Filtra apenas emails com `status = 'sent'` para não reenviar falhas
- Deduplica por `envio_id` + `evento_id` para não enviar duplicados

