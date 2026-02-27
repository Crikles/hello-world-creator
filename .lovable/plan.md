

# Cobranca de SMS por Envio Individual

## Problema Atual

O custo do SMS (`custo_sms_rastreio`) e cobrado **uma unica vez** no primeiro avanco de status (quando `currentOrdem === 0`), junto com os outros servicos. Porem, o SMS e disparado em **cada evento** do fluxo (exceto NF-e). Num template de 8 eventos, sao 7 SMS enviados mas apenas 1 cobrado.

## Solucao

### 1. Remover SMS da cobranca inicial (`src/lib/email-trigger.ts`)

No bloco de debito que ocorre quando `currentOrdem === 0` (linhas 93-133), **remover** o trecho que soma `custo_sms_rastreio` ao total inicial. O SMS nao sera mais cobrado antecipadamente.

### 2. Cobrar SMS individualmente a cada envio (`src/lib/email-trigger.ts`)

No trecho onde o SMS e de fato disparado (apos linha ~230), adicionar logica de debito individual:
- Buscar `user_id` da loja (ja disponivel ou buscar)
- Buscar `custo_sms_rastreio` do `system_config`
- Chamar `debit_user_credits` com o valor unitario do SMS
- Descricao: "SMS enviado - {status_label}"
- Se saldo insuficiente, pular o SMS (log warning) mas nao bloquear o fluxo de email

### 3. Atualizar UI em Postagens (`src/pages/Postagens.tsx`)

**Card de SMS no Feature Toggles**: Alterar a descricao e o custo exibido para refletir que e cobrado por mensagem:
- Descricao: "Cobrado por SMS enviado (ex: 7x num fluxo de 8 eventos)"
- Custo exibido: mostrar o valor unitario com indicador "/SMS" em vez de "/envio"

**Resumo de Custo**: No bloco "Custo por Envio" (linhas 580-608):
- Calcular dinamicamente quantos SMS serao enviados no template ativo (total de eventos menos os que tem `enviar_nfe_pdf = true`)
- Mostrar: "SMS (Nx {custo_unitario})" com o subtotal
- Atualizar o total geral para refletir o custo real

### 4. Indicador de SMS nos Eventos do Fluxo

Adicionar um badge de SMS nos cards de evento (junto com Email e NFe) para os eventos que enviam SMS (todos exceto NF-e, quando SMS esta ativo). Isso ajuda o usuario a visualizar quais eventos geram cobranca de SMS.

---

## Detalhes Tecnicos

### Arquivo: `src/lib/email-trigger.ts`

**Remover do bloco de debito inicial (linhas ~104-107):**
```text
// REMOVER:
if (config.ativar_site_rastreio && costMap["custo_sms_rastreio"]) {
    total += costMap["custo_sms_rastreio"];
    activeServices.push("Rastreio");
}
```

**Adicionar debito individual no bloco de SMS (apos linha ~237):**
```text
// Antes de enviar o SMS, debitar o custo
const smsCost = costMap["custo_sms_rastreio"] || 0;
if (smsCost > 0) {
    const { data: smsDebitOk } = await supabase.rpc("debit_user_credits", {
        _user_id: lojaUserId,
        _quantidade: smsCost,
        _descricao: `SMS enviado - ${nextEvent.status_label}`,
    });
    if (!smsDebitOk) {
        console.warn("Saldo insuficiente para SMS, pulando...");
        // Nao bloqueia o fluxo, apenas pula o SMS
    } else {
        // Envia o SMS normalmente
    }
}
```

Para ter acesso ao `user_id` e `costMap` no momento do SMS, mover a busca de `lojaData.user_id` e `costMap` para fora do bloco `if (currentOrdem === 0)`, tornando-os disponveis em todo o escopo da funcao.

### Arquivo: `src/pages/Postagens.tsx`

**Feature toggle do SMS** - Alterar descricao e formato do custo:
- `desc`: "Cobrado individualmente por SMS enviado."
- Custo com sufixo "/SMS"

**Custo por Envio** - Calcular SMS dinamicamente:
- Contar eventos sem `enviar_nfe_pdf` no template ativo = quantidade de SMS
- Multiplicar pela `custo_sms_rastreio`
- Exibir como "SMS (7x 0.25 moedas) = 1.75 moedas"

**Badges nos eventos** - Adicionar indicador de SMS nos cards de evento quando SMS ativo e evento nao e NF-e.

### Arquivos Modificados
1. `src/lib/email-trigger.ts` - Logica de cobranca
2. `src/pages/Postagens.tsx` - UI de custos e indicadores

