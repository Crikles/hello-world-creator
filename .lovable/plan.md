

# Corrigir calculo de moedas com valores decimais e sincronizar com painel admin

## Problema Principal

As colunas `creditos.saldo` e `creditos_transacoes.quantidade` sao do tipo `integer`. Quando o sistema tenta debitar 3.25 moedas, o valor e truncado para 3. Por isso, com tudo ativo (1 + 1 + 0.25 + 1 = 3.25), so debita 3.

Alem disso, os valores exibidos na pagina de Postagens estao hardcoded ("1 moeda", "+0,25 moeda") em vez de ler da tabela `system_config`.

## Mudancas

### 1. Migracao SQL - Alterar colunas para NUMERIC

Alterar o tipo das colunas para suportar decimais:

- `creditos.saldo`: de `integer` para `numeric` (default 0)
- `creditos_transacoes.quantidade`: de `integer` para `numeric`

A funcao `debit_user_credits` ja aceita `NUMERIC` como parametro e faz aritmetica correta, so precisa que as colunas de destino tambem sejam `numeric`.

### 2. Postagens.tsx - Exibir valores dinamicos do system_config

Substituir os valores hardcoded nos badges e no card de custo por valores lidos de `systemConfigValues`:

- Badge "1 moeda" da NF-e -> `systemConfigValues.custo_nfe_email`
- Badge "1 moeda" do Rastreio -> `systemConfigValues.custo_email_rastreio`
- Badge "+0,25 moeda" do SMS -> `systemConfigValues.custo_sms_rastreio`
- Badge "+1 moeda" da Taxacao -> `systemConfigValues.custo_taxacao`
- Card "Custo por Envio" -> mesmos valores dinamicos

Funcao auxiliar para formatar: exibir "1 moeda" ou "0,25 moeda" conforme o valor.

### 3. AppSidebar.tsx - Exibir saldo com decimais

O saldo na sidebar mostra `{saldo ?? 0} moedas`. Como o saldo agora pode ser decimal (ex: 4.75), formatar com `toFixed(2)` ou usar `toLocaleString('pt-BR')` para exibir "4,75 moedas".

## Arquivos alterados

| Arquivo | Acao |
|---|---|
| Migracao SQL | ALTER colunas saldo e quantidade para NUMERIC |
| `src/pages/Postagens.tsx` | Badges e card de custo lendo de system_config |
| `src/components/layout/AppSidebar.tsx` | Formatar saldo decimal |

## Resultado esperado

- Debito correto de 3.25 moedas com todos os servicos ativos
- Alteracoes no painel admin (system_config) refletem automaticamente nos valores mostrados ao usuario
- Saldo exibido com precisao decimal

