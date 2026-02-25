

# Corrigir Dominio de Logistica e URL de Taxacao

## Problema 1: Dominio rastreio.logisticajltransportes.com nao carrega as rotas

O dominio propagou mas a aplicacao publicada precisa reconhecer o hostname para renderizar as rotas de logistica (`LogisticsRoutes`). O `domain-config.ts` ja esta correto com `rastreio.logisticajltransportes.com`. O problema pode ser que o app precisa ser republicado apos a configuracao do dominio customizado. Vou verificar se ha algum outro bloqueio.

**Acao**: Confirmar que o dominio esta adicionado nas configuracoes do projeto Lovable (Settings > Domains) e republicar.

## Problema 2: URL errada no email de Taxacao

O botao do email de taxacao esta apontando para `https://app.jltransportes.pro/p/{envioId}` porque o codigo usa uma variavel `appBaseUrl` com fallback para esse dominio antigo.

**Arquivo**: `supabase/functions/send-email/index.ts`

Existem 2 lugares que precisam ser corrigidos:

1. **Linha 117** - Parametro default da funcao `buildEmailHtml`:
```
appBaseUrl = "https://app.jltransportes.pro"
```
Trocar para:
```
appBaseUrl = "https://rastreio.logisticajltransportes.com"
```

2. **Linha 633** - Onde o `appBaseUrl` e definido antes de chamar `buildEmailHtml`:
```
const appBaseUrl = Deno.env.get("APP_BASE_URL") || "https://app.jltransportes.pro";
```
Trocar para:
```
const appBaseUrl = Deno.env.get("APP_BASE_URL") || "https://rastreio.logisticajltransportes.com";
```

Isso faz com que o link de pagamento no email de taxacao aponte para `https://rastreio.logisticajltransportes.com/p/{envioId}`, que ja tem a rota `/p/:envioId` configurada no `LogisticsRoutes`.

## Resumo

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/send-email/index.ts` (linha 117) | Default de `appBaseUrl` para `rastreio.logisticajltransportes.com` |
| `supabase/functions/send-email/index.ts` (linha 633) | Fallback de `appBaseUrl` para `rastreio.logisticajltransportes.com` |

Apos as mudancas, a edge function sera redeployada automaticamente.

