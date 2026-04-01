
Plano: corrigir por que o PIX da Corvex cria o lead, mas não entrega email/SMS corretamente

1. Confirmar o que já está funcionando
- O lead de recuperação está sendo criado para a sua loja:
  - `loja_id = 9e2a3528-640c-4839-b886-b55502b4df0b`
  - lead recente `pix_pendente` criado em `2026-04-01 23:26:03`
- O SMS chegou a ser processado no backend:
  - `send-recovery-sms` registrou envio com sucesso para `5511999998888`
  - no banco, esse lead já tem `sms_sent_at` preenchido
- Portanto, o problema principal agora não é mais “Corvex não disparou nada”; o fluxo disparou, mas há falhas específicas de entrega/integração.

2. Causa principal encontrada no email
- O `webhook-corvex` chama `send-recovery-email` com:
  - `{ lead_id, loja_id, tipo }`
- Mas a função `send-recovery-email` hoje exige:
  - `{ loja_id, customer_email, tipo }`
- Resultado:
  - para Corvex, Luna e Adoorei, a chamada está incompatível
  - o email não encontra os dados esperados e não envia
- Isso explica por que o lead foi criado, mas `email_sent_at` continua vazio.

3. Ajuste que vou implementar
- Tornar `send-recovery-email` compatível com os dois formatos:
  - formato por `lead_id`
  - formato por `customer_email`
- Fluxo novo da função:
  - se vier `lead_id`, buscar o lead diretamente por ID
  - se vier `customer_email`, manter o comportamento atual
- Isso corrige de uma vez:
  - `webhook-corvex`
  - `webhook-luna`
  - `webhook-adoorei`
  - sem quebrar `webhook-recovery`, `webhook-zedy` e `shopify-webhook`

4. Ajustes adicionais para deixar o fluxo robusto
- Em `send-recovery-email`:
  - validar `emailResponse.ok` antes de marcar o lead como enviado
  - só preencher `email_sent_at` e status quando o provedor realmente aceitar o envio
  - registrar erro mais claro no log quando a chamada falhar
- Em `send-recovery-sms`:
  - manter o envio como está, porque o backend já mostrou sucesso
  - melhorar o update do lead para refletir status coerente do disparo
- Na tela de Recuperação:
  - o lead atual aparece como `pendente` mesmo tendo `sms_sent_at`
  - vou alinhar os status exibidos para ficar claro quando email e/ou SMS foram disparados

5. Ponto importante sobre email no seu projeto
- O domínio de email do projeto está com configuração pendente:
  - `notify.rastreio.centrojadlog.com`
  - status: pendente
- Isso pode impedir recebimento de emails em produção até a configuração ser concluída.
- Mesmo assim, o bug do payload incompatível precisa ser corrigido porque hoje ele já impede o disparo do email antes mesmo de qualquer validação final de entrega.

6. Arquivos que serão ajustados
- `supabase/functions/send-recovery-email/index.ts`
  - aceitar `lead_id`
  - unificar busca do lead
  - corrigir marcação de sucesso/erro
- `supabase/functions/send-recovery-sms/index.ts`
  - melhorar atualização de status/log do lead
- `src/pages/RecuperacaoVendas.tsx`
  - melhorar exibição do status dos leads disparados
- Opcionalmente revisar chamadas compatíveis em:
  - `supabase/functions/webhook-corvex/index.ts`
  - `supabase/functions/webhook-luna/index.ts`
  - `supabase/functions/webhook-adoorei/index.ts`

7. Resultado esperado após a correção
- Gerar um PIX pendente na Corvex deve:
  - criar o lead imediatamente
  - disparar o SMS imediatamente
  - disparar o email imediatamente
  - atualizar corretamente os timestamps/status no painel
- Se o email ainda não chegar depois disso, o próximo bloqueio será a infraestrutura de domínio de email pendente, não mais a lógica do webhook.

8. Detalhes técnicos
```text
Hoje:
webhook-corvex -> send-recovery-email({ lead_id, loja_id, tipo })
send-recovery-email espera -> { customer_email, loja_id, tipo }
Resultado -> incompatibilidade silenciosa

Após ajuste:
send-recovery-email
  if lead_id:
    busca lead por id
  else if customer_email:
    busca lead por email
  envia email
  só marca sucesso se provider retornar ok
```
