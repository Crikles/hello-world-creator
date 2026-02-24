
# Corrigir Barra de Progresso e Disparo de Emails

## Problemas Identificados

### 1. Barra de progresso comeca em 25%
No arquivo `src/pages/Envios.tsx`, o status `pendente` tem valor de progresso `25` (linha 36). Deveria ser `0` para indicar que o envio esta na estaca zero.

### 2. Faltam 2 emails dos 6 do fluxo
O usuario tem 6 eventos no fluxo ativo:

| Ordem | Evento | status_label | Disparado? |
|---|---|---|---|
| 1 | Nota Fiscal Emitida | Postado | NAO |
| 2 | Pedido Coletado | Coletado | NAO |
| 3 | Em Transito | Em Transito | SIM |
| 4 | Centro de Distribuicao | Centro Local | SIM |
| 5 | Saiu para Entrega | Saiu para Entrega | SIM |
| 6 | Entregue | Entregue | SIM |

**Causa raiz**: Quando o usuario clica "Iniciar Pendentes" (pendente -> em_transito), o mapeamento em `email-trigger.ts` busca apenas os labels `["Em Transito", "Em Rota", "Centro Local"]` para o status `em_transito`. Os labels "Postado" (NF) e "Coletado" nao estao incluidos nesse mapeamento, entao esses 2 emails nunca sao enviados.

O status interno `coletado` existe no mapa mas nunca e usado como status real do sistema (o sistema so tem: pendente, em_transito, saiu_para_entrega, entregue).

---

## Solucao

### 1. Zerar a barra de progresso para status pendente

Alterar o valor de `pendente` no objeto `statusProgress` de `25` para `0`.

### 2. Incluir todos os eventos anteriores no disparo

Quando o status muda de `pendente` para `em_transito` (botao "Iniciar"), o sistema deve disparar TODOS os eventos intermediarios que seriam pulados. Isso significa incluir "Postado", "Pedido Confirmado", "Nota Fiscal Emitida" e "Coletado" junto com "Em Transito", "Em Rota" e "Centro Local" no mapeamento do status `em_transito`.

Novo mapeamento:

```text
em_transito: ["Postado", "Pedido Confirmado", "Nota Fiscal Emitida", "Coletado", "Em Transito", "Em Rota", "Centro Local"]
```

Como o status `pendente` nao dispara emails (standby), ao iniciar o fluxo (pendente -> em_transito), todos os eventos da ordem 1 ate a ordem 4 serao processados sequencialmente. A verificacao individual de `isAtivo` e `enviar_email` continua garantindo que apenas eventos habilitados sejam enviados.

O mapeamento de `pendente` sera removido ja que nunca e usado.

---

## Detalhes Tecnicos

### Arquivos a modificar

| Arquivo | Mudanca |
|---|---|
| `src/pages/Envios.tsx` | Alterar `statusProgress.pendente` de `25` para `0` |
| `src/lib/email-trigger.ts` | Expandir o mapeamento de `em_transito` para incluir labels de NF e Coletado, remover `pendente` e `coletado` do mapa |
