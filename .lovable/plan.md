## Verificação prévia (já feita)

**696 envios** da loja `useonefit2026@gmail.com` parados na etapa "Chegou perto de você":
- ✅ 696/696 com e-mail no formato válido (`xxx@yyy.zz`)
- ✅ 653 e-mails únicos (alguns clientes com 2+ pedidos — receberão um e-mail por pedido)
- ✅ 696/696 com `codigo_rastreio` preenchido e já no padrão ATLAS (sufixo `AT`, nenhum com `JL`)

**Template do e-mail** (`postagem_eventos` da etapa "Chegou perto de você"):
- Assunto: `📍 Chegou perto de você`
- Corpo: `Seu pedido chegou no centro de distribuição da sua região. Quase lá!`
- Cor primária: `#6366f1` · Cor do botão CTA: `#1a1a1a`
- `enviar_emails = true` na config da loja

**Botão CTA do e-mail** (fluxo confirmado em código):
- Link no e-mail: `https://<projeto>.functions.supabase.co/functions/v1/redirect?c={codigo_rastreio}`
- `redirect` redireciona 302 para `https://atlas-cargo.org/r/{codigo_rastreio}` ✅
- Cada cliente abrirá o site da Atlas já com o próprio código de rastreio carregado.

**Cobrança**: o débito principal de e-mail só ocorre na primeira etapa (`ordem = 0`). Como os 696 já estão em ordem 7, **nenhum crédito é debitado**. O upsell já está gateado por `sem_cobranca = true` e o template "Chegou perto de você" também não está no mapa de upsell.

## O que vou fazer

Disparar o e-mail da etapa atual ("Chegou perto de você") para os 696 envios, **sem avançar nada** no fluxo:

1. Criar uma edge function nova `bulk-send-status-email` que:
   - Recebe `loja_id`, `evento_id`, `status_label`, `ultimo_evento_ordem`.
   - Busca todos os envios da loja em `deleted_at IS NULL` que correspondam ao status/ordem informados.
   - Invoca `send-email` em lotes de **8 paralelos**, com pequena pausa entre lotes (evita 429 do Resend).
   - Cada chamada usa o `evento_id` da etapa "Chegou perto de você" — a função `send-email` já tem idempotência por `(envio_id, evento_id)` em `postagem_email_log`, então re-execuções são seguras (nenhum e-mail duplicado).
   - **Não altera `ultimo_evento_ordem`, nem `status_label`, nem `proximo_avanco_em`** — só dispara o e-mail.
   - Retorna contagem: enviados / pulados (já enviados) / falhas.
2. Deploy da função.
3. Invocar via `curl_edge_functions` (service role) com:
   - `loja_id = 86829180-1015-402d-ba18-b772cf50694e`
   - `evento_id = 36e1e9aa-60fe-4423-bbc9-fe7543997c07`
   - `status_label = "Chegou perto de você"`
   - `ultimo_evento_ordem = 7`
4. Verificar contagem final em `postagem_email_log` para confirmar 696 envios processados.

## Salvaguardas

- A função só processa envios que **estão exatamente na ordem/status passados** — não dispara nada de outras etapas.
- Idempotência: rodar de novo não duplica e-mails.
- Caso o Resend retorne 429 em algum envio, o log fica como `failed` e podemos reprocessar — a função pode ser invocada novamente sem risco.

## Detalhes técnicos

- Nova função: `supabase/functions/bulk-send-status-email/index.ts`.
- Sem mudanças de schema, sem alteração no `advance-shipments`, sem alteração no `send-email`.
- Sem UI nova — execução one-shot via edge function.
