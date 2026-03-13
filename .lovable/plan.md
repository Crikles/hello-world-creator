

# Fix: Emails de Falha Entrega e Taxação exibindo tags raw

## Problema

O `corpo_email` dos eventos "Falha Entrega" armazena tags de metadados como `{{falha_cor_botao:#hex}}`, mas a função `parseFalhaEntregaSettings` no `send-email` verifica a existência de `{{falha_checkout_url:` — que NÃO existe mais no corpo_email. Resultado: retorna `null`, cai no template genérico, e as tags aparecem como texto visível no email.

## Correção em `supabase/functions/send-email/index.ts`

### 1. Atualizar `parseFalhaEntregaSettings` (linha 146)

Mudar a condição de entrada para detectar qualquer tag `{{falha_` (não só `{{falha_checkout_url:`). Buscar o checkout_url e valor_taxa da tabela `postagem_config` em vez de tags (já que são salvos lá pelo FailedDeliveryConfig). Extrair a mensagem limpa cortando antes da primeira tag `{{falha_`.

### 2. Atualizar a chamada de `buildFalhaEntregaEmailHtml` (linha 192)

Passar o `checkout_url_falha` e `valor_taxa_falha` do `postagem_config` que já é carregado no fluxo do send-email.

### 3. Limpar tags de metadados no fallback genérico (linha 200)

Adicionar um regex para remover todas as tags `{{falha_*}}` e `{{taxacao_*}}` do `corpoEmail` antes de usá-lo como mensagem, para que caso algum evento caia no path genérico, as tags nunca apareçam.

```typescript
// After line 200, strip any metadata tags from the message
mensagem = mensagem.replace(/\{\{(?:falha|taxacao)_[^}]*\}\}/g, "").trim();
```

### 4. Verificar Taxação

A Taxação usa `{{taxacao_url:` que É salvo no corpo_email pelo TaxacaoConfig, então provavelmente funciona. Mas por segurança, aplicar o mesmo strip de tags extras no path genérico.

## Arquivo alterado
- `supabase/functions/send-email/index.ts`

