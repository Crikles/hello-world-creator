
Objetivo: eliminar as falhas de WhatsApp e expor o motivo real de cada erro, para ficar estável para todos os usuários.

Diagnóstico confirmado (com dados reais):
1) Falha sistêmica no envio automático de “novo pedido”
- Janela de auto-disparo (até 10s após criação do envio): 29 falhas / 0 sucessos (24h).
- Esse fluxo usa a função `auto-whatsapp-new-order`.
- Ela está com endpoint diferente: `https://apikas.uazapi.com`, enquanto os outros envios que funcionam usam `https://rushsend.uazapi.com`.
- Resultado: os disparos automáticos nascem “failed”.

2) Instância desconectada sendo tratada como conectada
- A instância `mi11 lite -busines` (`13c1bf1f...`) concentra falhas no fluxo de fila.
- Teste de status retornou `disconnected`, e testes de envio retornaram `WhatsApp disconnected`.
- Como o sistema usa status salvo no banco, uma instância stale pode continuar na rotação e gerar falhas.

3) Falta rastreabilidade do erro
- `whatsapp_message_log` e `whatsapp_send_queue` não guardam motivo/retorno do provedor.
- UI mostra “Falha no envio”, sem causa técnica confiável para suporte.

Plano de correção:
1) Padronizar endpoint da UAZAPI (correção principal)
- Arquivo: `supabase/functions/auto-whatsapp-new-order/index.ts`
- Trocar `UAZAPI_BASE` para `https://rushsend.uazapi.com` (mesmo padrão dos outros fluxos).
- Melhorar logs dessa função para registrar status HTTP e payload de erro do provedor.

2) Blindar rotação contra instâncias desconectadas
- Arquivos:
  - `supabase/functions/auto-whatsapp-new-order/index.ts`
  - `supabase/functions/send-whatsapp/index.ts` (send/send-queue)
  - `supabase/functions/advance-shipments/index.ts` (processador da fila)
- Antes de enviar, validar status real da instância via API e atualizar `whatsapp_instances.status`.
- Excluir da rotação as que estiverem `disconnected`.
- Se uma instância falhar por desconexão no processamento da fila, tentar fallback automático em outra instância ativa (sem perder o item).

3) Persistir motivo real de falha no banco
- Migration em:
  - `whatsapp_message_log`: adicionar `error_reason`, `provider_response` (jsonb), `http_status`.
  - `whatsapp_send_queue`: adicionar `error_reason`, `provider_response` (jsonb), `http_status`, `retry_count`.
- Em todos os fluxos de envio, salvar o detalhe real retornado pela UAZAPI.

4) Exibir o motivo real na tela de WhatsApp
- Arquivo: `src/pages/WhatsApp.tsx`
- Ajustar query de logs para buscar os novos campos de erro.
- Tooltip/label de falha passa a mostrar mensagem técnica real (ex.: “WhatsApp disconnected”, “número inválido”, etc.), não só texto genérico.

5) Auditoria global pós-fix (todos os usuários)
- Rodar verificação geral de taxa de falha por loja/instância.
- Confirmar que envios automáticos de novo pedido voltaram a ter sucesso.
- Identificar e marcar automaticamente instâncias problemáticas para fora da rotação.

Critério de sucesso:
- Auto-disparo de novo pedido deixa de ficar 100% em falha.
- Instância desconectada não entra mais em rotação.
- Cada falha passa a ter motivo explícito no banco e na UI.
- Comportamento consistente para todos os usuários, não só para uma loja.
