

# Análise do Fluxo de SMS

## Status Atual

Baseado na análise do código e dos logs, o fluxo de SMS **está funcionando**. Os logs mostram um envio recente bem-sucedido:
```
Sending SMS: { phone: "551313123131", status_label: "Coletado", messageLength: 147 }
SMS API response: 200 {"message":"SMS sent successfully"...}
```

## Como Funciona Hoje

O SMS é disparado automaticamente pelo cron `advance-shipments` (a cada 5 min) e também pelo `email-trigger.ts` (client-side), com a seguinte condição:

1. `config.ativar_site_rastreio` deve ser `true` (toggle "Envio de Etapas por SMS")
2. O envio deve ter `cliente_telefone` preenchido
3. O evento não pode ter `enviar_nfe_pdf` ativo (eventos de NF-e são só email)
4. O usuário precisa ter saldo suficiente para o custo do SMS

## Possíveis Problemas Identificados

### 1. Secret `INTEGRAX_API_KEY` pode estar desatualizada
O token que você informou (`4a4e07b7-349b-4ef2-9397-59f8f8bf2e7b`) pode diferir do valor salvo no secret `INTEGRAX_API_KEY`. Se o token foi renovado, o secret precisa ser atualizado.

### 2. Saldo insuficiente bloqueia silenciosamente
Se o `custo_sms_rastreio` em `system_config` for > 0 e o usuário não tiver saldo, o SMS é ignorado sem erro visível ao usuário. Não há feedback na UI informando que o SMS falhou por falta de créditos.

### 3. Nenhum log visível para o usuário
O SMS falha silenciosamente no client-side (apenas console.error). O usuário não recebe toast ou indicação de que o SMS foi ou não enviado.

## Plano de Correção

### A. Atualizar secret INTEGRAX_API_KEY
Confirmar/atualizar o valor do secret para o token informado.

### B. Adicionar logs de SMS no advance-shipments
Adicionar console.log explícito quando o SMS é pulado por saldo insuficiente ou telefone vazio, facilitando diagnóstico futuro.

### C. Verificar a configuração do custo
Consultar `system_config` para confirmar que a chave `custo_sms_rastreio` existe e tem valor correto.

## Mudanças

| Local | O quê |
|---|---|
| Secret `INTEGRAX_API_KEY` | Atualizar para o token correto se necessário |
| `advance-shipments/index.ts` | Melhorar logs de diagnóstico para SMS |

