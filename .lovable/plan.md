

# SMS em Todos os Eventos do Fluxo

## Resumo

Expandir o disparo de SMS para todos os eventos do fluxo de rastreio (nao apenas "Coletado"). Cada status_label tera uma mensagem especifica. A edge function `send-sms` passara a receber o `status_label` do evento para selecionar a mensagem correta.

## Mapeamento de Mensagens por status_label

| status_label | Mensagem SMS |
|---|---|
| Postado | `Ola {name}. Seu CODIGO DE RASTREIO esta disponivel, acesse: [{link}] FIQUE ATENTO A SEU EMAIL.` (mantido) |
| Coletado | `Ola {name}. Seu CODIGO DE RASTREIO esta disponivel, acesse: [{link}] FIQUE ATENTO A SEU EMAIL.` (mantido, usado tambem para "Pedido Confirmado") |
| Em Transito | `Ola {name}, seu produto esta no status: [EM TRANSITO] Confira sua caixa de email.` |
| Centro Local | `Ola {name}, seu produto esta no status: [CENTRO DE DISTRIBUICAO] Confira sua caixa de email.` |
| Taxacao | `Ola {name}, seu produto esta no status: [EM OBSERVACAO] Confira sua caixa de email.` |
| Pago | `Ola {name}, seu produto esta no status: [PAGAMENTO CONFIRMADO] Confira sua caixa de email.` |
| Saiu para Entrega / Em Rota | `Ola {name}, seu produto esta no status: [SAIU PARA ENTREGA] Confira sua caixa de email.` |
| Entregue | `Ola {name}, seu produto esta no status: [ENTREGUE] Confira sua caixa de email.` |

Nota: "Pago" nao foi mencionado explicitamente, adicionei como `[PAGAMENTO CONFIRMADO]`. "Centro Local" e "Postado" tambem foram cobertos seguindo a mesma logica.

## Mudancas

### 1. Edge Function `send-sms` (editar)

- Aceitar novo parametro opcional `status_label` no body
- Criar um mapa de mensagens por status_label
- Se `status_label` for "Coletado" ou "Postado" ou nao informado, usar a mensagem atual (com link de rastreio)
- Para os demais, usar o template `Ola {name}, seu produto esta no status: [STATUS] Confira sua caixa de email.`
- Remover limite de 150 caracteres (as mensagens novas sao curtas o suficiente) ou aumentar para 160

### 2. `src/lib/email-trigger.ts` (editar)

- Remover a condicao que restringe SMS apenas ao status "Coletado"
- Disparar SMS em TODOS os eventos quando `config.ativar_site_rastreio === true` e `shipment.cliente_telefone` existir
- Passar `status_label` do evento atual para a edge function

## Detalhes Tecnicos

### Edge Function - Mapa de mensagens

```text
const smsMessages: Record<string, (name: string, link: string) => string> = {
  "Coletado": (name, link) => `Ola ${name}. Seu CODIGO DE RASTREIO esta disponivel, acesse: [${link}] FIQUE ATENTO A SEU EMAIL.`,
  "Postado":  (name, link) => `Ola ${name}. Seu CODIGO DE RASTREIO esta disponivel, acesse: [${link}] FIQUE ATENTO A SEU EMAIL.`,
  "Em Transito":       (name) => `Ola ${name}, seu produto esta no status: [EM TRANSITO] Confira sua caixa de email.`,
  "Centro Local":      (name) => `Ola ${name}, seu produto esta no status: [CENTRO DE DISTRIBUICAO] Confira sua caixa de email.`,
  "Taxacao":           (name) => `Ola ${name}, seu produto esta no status: [EM OBSERVACAO] Confira sua caixa de email.`,
  "Pago":              (name) => `Ola ${name}, seu produto esta no status: [PAGAMENTO CONFIRMADO] Confira sua caixa de email.`,
  "Saiu para Entrega": (name) => `Ola ${name}, seu produto esta no status: [SAIU PARA ENTREGA] Confira sua caixa de email.`,
  "Em Rota":           (name) => `Ola ${name}, seu produto esta no status: [SAIU PARA ENTREGA] Confira sua caixa de email.`,
  "Entregue":          (name) => `Ola ${name}, seu produto esta no status: [ENTREGUE] Confira sua caixa de email.`,
};
```

O status_label vem com acentos do banco (ex: "Em Trânsito", "Taxação"). A funcao usara `removeAccents()` para normalizar a chave antes de buscar no mapa.

### email-trigger.ts - Disparo expandido

O bloco de SMS muda de:
```text
if (config.ativar_site_rastreio && nextEvent.status_label === "Coletado" && shipment.cliente_telefone)
```

Para:
```text
if (config.ativar_site_rastreio && shipment.cliente_telefone)
```

E o body passa a incluir `status_label: nextEvent.status_label`.

### Arquivos alterados

| Arquivo | Acao |
|---|---|
| `supabase/functions/send-sms/index.ts` | Adicionar mapa de mensagens por status_label |
| `src/lib/email-trigger.ts` | Remover filtro "Coletado", passar status_label |

