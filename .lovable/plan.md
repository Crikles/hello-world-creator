
# Corrigir: Email de "Pago" nao disparado ao aprovar pela Taxacao

## Problema Identificado

No arquivo `src/lib/email-trigger.ts` (linha 86-97), quando o proximo evento tem `status_label === "Pago"`, o envio do email depende do toggle `config.ativar_taxacao`:

```typescript
} else if (nextEvent.status_label === "Taxação" || nextEvent.status_label === "Pago") {
    isAtivo = config.ativar_taxacao;  // Se false, email nao envia
}
```

Quando o usuario clica "Aprovar" na pagina Taxacao, o status avanca para "Pago" (a atualizacao do banco ocorre antes na linha 71), mas o email e pulado se `ativar_taxacao` for `false` ou em cenarios onde o toggle nao esta ativo. A aprovacao manual e uma acao explicita - o email deve sempre ser enviado.

## Solucao

Adicionar um parametro opcional `forceSendEmail` na funcao `triggerNextEmail`. Quando chamado pela pagina de Taxacao (aprovacao manual), esse parametro forca o envio do email independente dos toggles de configuracao.

### Arquivo: `src/lib/email-trigger.ts`

1. Alterar a assinatura da funcao para aceitar `forceSendEmail?: boolean`
2. Na verificacao de email (linha 95), adicionar condicao: se `forceSendEmail` for `true`, ignorar o check de `isAtivo`

```text
// Antes (linha 95):
if (!isAtivo || !nextEvent.enviar_email) {

// Depois:
if ((!isAtivo && !forceSendEmail) || !nextEvent.enviar_email) {
```

### Arquivo: `src/pages/Taxacao.tsx`

Alterar a chamada do `triggerNextEmail` no `approveMutation` (linha 123) para passar `forceSendEmail = true`:

```typescript
const result = await triggerNextEmail(envioId, loja.id, true);
```

### Impacto

- A pagina de Envios continua funcionando normalmente (sem o parametro, comportamento padrao)
- A pagina de Taxacao sempre envia o email de "Pago" ao aprovar manualmente
- O toggle `ativar_taxacao` continua controlando o disparo automatico dos eventos de Taxacao/Pago no fluxo normal
