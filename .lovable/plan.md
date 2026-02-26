

# Corrigir mapeamento de chaves no debito de moedas

## Problema

As chaves usadas no codigo `email-trigger.ts` nao correspondem as chaves reais na tabela `system_config`. O debito esta falhando silenciosamente para 3 dos 4 servicos.

| Chave no codigo (errada) | Chave real no banco |
|---|---|
| `custo_nfe` | `custo_nfe_email` |
| `custo_email` | `custo_email_rastreio` |
| `custo_rastreio` | `custo_sms_rastreio` |
| `custo_taxacao` | `custo_taxacao` (ok) |

## Valores confirmados

| Servico | Moedas | Chave |
|---|---|---|
| Nota Fiscal | 1 | custo_nfe_email |
| Emails | 1 | custo_email_rastreio |
| SMS | 0.25 | custo_sms_rastreio |
| Taxacao | 1 | custo_taxacao |

## Mudanca

### Arquivo: `src/lib/email-trigger.ts`

Corrigir as 3 referencias de chaves incorretas nas linhas 97-108:

- `costMap["custo_nfe"]` -> `costMap["custo_nfe_email"]`
- `costMap["custo_email"]` -> `costMap["custo_email_rastreio"]`
- `costMap["custo_rastreio"]` -> `costMap["custo_sms_rastreio"]`

Nenhuma outra alteracao necessaria. Os valores no banco ja estao corretos.

