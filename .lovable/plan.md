## Status operacional (últimas 24h)

Tudo o que é fluxo principal está rodando normalmente:

| Métrica | Valor |
|---|---|
| Envios criados (24h) | **319** |
| Envios na última 1h | 3 |
| Pedidos recebidos via webhook | 78 |
| LiveView ativos (5 min) | 15 sessões |
| E-mails de postagem enviados (sent) | 42 |
| SMS / Confirmação de pagamento | sem atividade no período (sem falhas) |
| Edge functions `rastreio-info`, `webhook-resend`, `redirect`, `send-email` | bootando e respondendo OK |
| Logs de auth | apenas `bad_jwt` esperado de sessões expiradas |

**Conclusão:** webhooks, geração de envios, cron `advance-shipments`, LiveView e envio de e-mails reais estão operacionais.

---

## 1 problema encontrado (não é bug do sistema, mas precisa de guard)

A tabela `postagem_email_log` mostra **2.795 falhas em 24h**, mas vindo de apenas **2 destinatários** com domínio digitado errado pelo cliente final:

- `...@gmail.com99` → 1.398 tentativas
- `...@gmail.como9` → 1.397 tentativas

O cron está reprocessando esses envios eternamente porque o e-mail bate em domínio inválido no Resend. Isso:
- Gasta requisições ao Resend.
- Polui logs e dificulta enxergar falhas reais.
- Não atrapalha os outros 317 envios saudáveis.

## Correção proposta (pequena e cirúrgica)

1. **Migration**: criar função `public.is_valid_email_domain(text)` que valida TLD básico (regex simples, sem chamadas externas) e marca como "domínio inválido" e-mails que não passam.
2. **Edge function `send-email` / `send-global-flow`**: antes de chamar Resend, validar com regex `^[^@]+@[^@]+\.[a-z]{2,24}$` e domínios que terminem em padrões claramente quebrados (`.como`, `.com\d+`, etc). Se inválido:
   - Gravar 1 vez em `postagem_email_log` com `status='invalid_email'` e `error_message='Endereço de e-mail inválido'`.
   - Marcar o envio com flag (`email_blocked=true` em `envios` ou usar status já existente) para o cron pular nas próximas iterações.
3. **Backfill rápido**: UPDATE nesses 2 envios para parar o loop imediatamente.

Sem isso, o número de "falhas" continuará crescendo ~120/h apenas por causa desses 2 e-mails ruins.

---

Posso seguir com a correção? Se preferir só o backfill (parar os 2 e-mails ruins agora, sem mudar código), também faço.