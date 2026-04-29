
## Limpeza segura do banco — sem afetar nenhuma operação

Vou rodar **somente** operações que removem dados redundantes ou logs antigos já consumidos. Nada toca pedidos, envios, créditos, configurações, e-mails enviados, rastreios, integrações ou qualquer coisa que esteja em uso ativo.

### O que será limpo (com volume confirmado)

| Operação | Volume | Espaço estimado |
|---|---|---|
| Zerar `raw_payload` em `pedidos` com mais de 30 dias | 12.612 linhas | ~35 MB diretos + ~200 MB em TOAST |
| Zerar `payload` em `webhook_logs` já processados com mais de 30 dias | 6.933 linhas | ~13 MB diretos + ~50 MB em TOAST |
| Apagar `whatsapp_send_queue` com status terminal (`cancelled`/`failed`/`sent`) com mais de 15 dias | 27.758 linhas | ~25 MB |
| Apagar `cron.job_run_details` com mais de 7 dias | logs internos do agendador | ~40 MB |
| Apagar `net._http_response` com mais de 3 dias | respostas HTTP internas do `pg_net` | ~15 MB |
| `VACUUM` em `pedidos` e `webhook_logs` para devolver espaço ao SO | — | recupera o espaço dos UPDATEs |

**Estimativa de redução:** ~280-330 MB (de 588 MB para ~280 MB).

### Por que NÃO afeta a operação

- **`pedidos.raw_payload`**: é o JSON bruto recebido do checkout, guardado para auditoria. Todos os dados úteis (cliente, endereço, produtos, status, valor) já estão extraídos em colunas próprias e continuam intactos. Pedido com mais de 30 dias já foi processado, faturado, enviado.
- **`webhook_logs.payload`**: cópia bruta do webhook que já foi processado (`processed = true`). O log da chamada continua existindo (pode ver que aconteceu, quando, status), só o JSON pesado vira NULL.
- **`whatsapp_send_queue`** (terminais): mensagens já enviadas, canceladas ou falhadas há mais de 15 dias. Pendentes, agendadas e em processamento ficam intactas.
- **`cron.job_run_details`** e **`net._http_response`**: tabelas internas do Postgres (extensões `pg_cron` e `pg_net`). São apenas logs de execução — apagar não afeta nem os jobs nem as requisições futuras.

### O que NÃO será tocado

- Tudo com menos de 30 dias.
- `envios`, `creditos`, `creditos_transacoes`, `lojas`, `empresas`, `profiles`, `user_roles`.
- `postagem_email_log`, `confirmacao_pagamento_log`, `cashback_log`, `recovery_leads`, `leads`.
- Qualquer configuração, template, integração, instância de WhatsApp, NF-e.

### Como será executado

Uma única migration com:
```sql
UPDATE pedidos SET raw_payload = NULL WHERE created_at < now() - interval '30 days' AND raw_payload IS NOT NULL;
UPDATE webhook_logs SET payload = '{}'::jsonb WHERE created_at < now() - interval '30 days' AND processed = true;
DELETE FROM whatsapp_send_queue WHERE status IN ('cancelled','failed','sent') AND created_at < now() - interval '15 days';
DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days';
DELETE FROM net._http_response WHERE created < now() - interval '3 days';
VACUUM (ANALYZE) public.pedidos;
VACUUM (ANALYZE) public.webhook_logs;
VACUUM (ANALYZE) public.whatsapp_send_queue;
```

Tempo total esperado: 10-30 segundos. Sem downtime. Sem trigger sendo disparado (a migration não toca colunas com trigger). Operação totalmente reversível em conceito (os dados deletados são logs internos descartáveis), mas na prática não há motivo para reverter.

Aprove e eu executo agora.
