

# Investigação e Correção: Segundo Botão URL do WhatsApp

## Situação Atual

O código no frontend (`WhatsApp.tsx`) e no backend (`send-whatsapp/index.ts`) já passa `btn2_text` e `btn2_url` corretamente para o array `choices`. A estrutura enviada para a UAZAPI deve ser algo como:

```text
choices: ["📦 Rastrear Pedido|https://...", "💬 Suporte|https://...", "Quero acompanhar meu pedido"]
```

Porém os logs recentes da Edge Function mostram apenas "shutdown" — nenhum envio real foi registrado recentemente, então não consigo ver o payload exato que foi enviado nem a resposta da UAZAPI.

## Possíveis Causas

1. **A Edge Function pode não ter sido re-deployada** após as últimas alterações que adicionaram `btn2_text`/`btn2_url`
2. **Os campos `btn2Text`/`btn2Url` estavam vazios** no momento do envio (são opcionais e usam `|| undefined`)
3. **Na rota `send-queue`**, o template de texto não substitui variáveis `{{nome}}`, `{{produto}}` etc. no servidor (bug separado)

## Plano

### 1. Re-deploy forçado da Edge Function
Garantir que a versão mais recente do `send-whatsapp/index.ts` (que já tem o `console.log` do payload e suporte a `btn2`) esteja efetivamente deployada.

### 2. Melhorar logging para diagnóstico
Adicionar logs mais detalhados no `send-whatsapp/index.ts`:
- Log do body recebido do frontend (para confirmar que `btn2_text` e `btn2_url` chegam)
- Log do array `choices` montado
- Log da resposta completa da UAZAPI

### 3. Corrigir substituição de variáveis no `send-queue`
Na rota `send-queue` (linha 589), o texto `msg_template` é usado sem substituir variáveis como `{{nome}}`, `{{produto}}`, `{{valor}}`, `{{codigo_rastreio}}`. Isso faz com que o cliente receba o texto cru com `{{nome}}` ao invés do nome real. Será corrigido adicionando a substituição de variáveis no servidor.

### Arquivos Modificados
- `supabase/functions/send-whatsapp/index.ts` — logs detalhados + fix de variáveis no send-queue

