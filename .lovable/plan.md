
# Plano de otimização: reduzir consumo da Lovable Cloud

Objetivo: reduzir 60–80% do consumo Cloud sem perder funcionalidade. Quatro frentes: reduzir crons, limpar dados antigos, desativar lojas inativas, e otimizar queries pesadas.

---

## 1. Reduzir frequência dos crons (maior ganho)

Hoje vários crons rodam a cada 1 minuto, gastando >40k execuções/dia.

| Cron | Frequência atual | Nova frequência | Economia |
|---|---|---|---|
| `advance-shipments` | 1 min | **3 min** | 66% |
| `backfill-missed-emails-drain` | 1 min | **remover** (fila já drenada) | 100% |
| `cron-check-pending-pix` | a verificar | manter ou 5 min | — |
| Outros crons internos | a auditar | conforme necessidade | — |

**Ação:** atualizar `cron.schedule` via migration. `advance-shipments` processando lotes maiores (100 envios em vez de 50) compensa o intervalo maior.

---

## 2. Limpeza de dados antigos (reduz storage e queries)

Já existe a função `cleanup_old_data()`. Vou:

- **Executar agora** uma limpeza completa manual
- **Agendar cron diário** às 03:00 BRT chamando `cleanup_old_data()` automaticamente
- **Ampliar a função** para incluir mais limpezas:
  - `email_logs`, `sms_logs`, `whatsapp_logs` > 60 dias (apenas registros `sent`/`delivered`)
  - `postagem_email_log` > 90 dias
  - `live_visitors` > 7 dias
  - `confirmacao_pagamento_log` > 90 dias
  - `signup_verifications` > 30 dias (status `verificado` ou `expirado`)
  - PDFs DANFE em storage > 90 dias (script separado)

---

## 3. Desativar lojas/contas inativas dos crons

Hoje `advance-shipments` varre **todas** as lojas. Muitas estão bloqueadas, sem saldo ou abandonadas — desperdício.

**Ação:** modificar `advance-shipments` para pular lojas com:
- Conta bloqueada (`profiles.bloqueado = true`)
- Sem saldo há mais de 7 dias e `auto_envio = false`
- Sem nenhum envio criado nos últimos 30 dias

---

## 4. Otimizar queries pesadas

- Adicionar índices que faltam em colunas usadas por crons:
  - `envios(loja_id, status, proximo_avanco_em)` parcial onde `deleted_at IS NULL`
  - `envios(proximo_avanco_em)` onde `status != 'entregue'`
  - `postagem_email_log(envio_id, status)`
- Substituir loops de paginação por agregações server-side onde possível

---

## 5. Storage de DANFEs (PDFs)

O bucket `nfe-pdfs` provavelmente é o maior consumidor de storage. Opções:

- **Lifecycle policy**: deletar PDFs > 90 dias automaticamente (cliente final já recebeu por e-mail)
- Manter só metadados (chave de acesso) — DANFE pode ser regenerada sob demanda

---

## Ordem de execução proposta

```text
1. Auditar crons existentes (listar todos via SQL)         [5 min]
2. Reduzir frequência de advance-shipments para 3 min     [migration]
3. Remover cron backfill-missed-emails-drain              [migration]
4. Executar cleanup_old_data() agora                      [insert]
5. Ampliar cleanup_old_data() com novas tabelas           [migration]
6. Agendar cleanup diário às 03:00                         [migration]
7. Adicionar índices faltantes                             [migration]
8. Pular lojas inativas em advance-shipments               [edit edge fn]
9. Limpeza de PDFs antigos no storage                      [script]
10. Validar consumo após 24h                               [observação]
```

---

## Impacto esperado

| Item | Redução estimada |
|---|---|
| Execuções de edge function | **-65%** (crons mais espaçados + skip de lojas inativas) |
| Tamanho do banco | **-30 a -50%** (limpeza de payloads/logs antigos) |
| Storage | **-40 a -70%** (DANFEs antigos) |
| Queries por hora | **-50%** (índices + agregações + skip de lojas) |
| **Custo Cloud total** | **-60 a -75%** |

---

## Riscos e mitigações

- **Crons mais lentos**: `advance-shipments` rodando a cada 3 min ainda é tranquilo para SLA de rastreio (etapas demoram horas/dias). Lotes maiores compensam.
- **Perda de logs antigos**: limpeza só apaga > 60–90 dias, fora da janela de auditoria normal. Antes do cleanup, faço um dump dos últimos 12 meses para `/mnt/documents` se quiser arquivar.
- **DANFEs apagados**: cliente final já recebeu por e-mail; admin pode regerar via `resend-nfe`. Se preferir, manter por 180 dias em vez de 90.

---

## Aprovação

Quando você aprovar, executo na ordem acima. Cada migration vai para sua aprovação individual antes de rodar. Posso fazer tudo de uma vez ou ir em etapas — recomendo etapas (1→3 primeiro, validar, depois 4→7, depois 8→9).
