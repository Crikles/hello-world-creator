

# Postagens - Corrigir Labels dos Toggles de Configuracao

## Problema

Os toggles atuais estao com nomes incorretos. O usuario quer separar claramente:
- **Nota Fiscal** = primeiro email (NF)
- **Rastreio por Email** = os emails de atualizacao de status que vem depois da NF
- **Site de Rastreio por SMS** = envia o link do site de rastreio via SMS (nao email)
- **Funil de Taxacao** = fluxo de taxacao com Email + SMS

## Mudancas nos 4 Toggles

| Toggle atual | Toggle correto | Campo no banco | Custo |
|---|---|---|---|
| NF + Emails de rastreamento | **Nota Fiscal enviada por email** | `enviar_nfe_email` | 1 moeda |
| Codigo de Rastreio | **Fluxo do Rastreio por E-mail** | `enviar_emails` | 1 moeda |
| Site de Rastreio | **Site do rastreio por SMS** | `ativar_site_rastreio` | +0,25 moeda |
| Funil de Taxacao | **Funil de Taxacao** (sem mudanca) | `ativar_taxacao` | +1 moeda |

## Detalhes das descricoes atualizadas

1. **Nota Fiscal enviada por email** - "Envia automaticamente a Nota Fiscal por email ao cliente."
2. **Fluxo do Rastreio por E-mail** - "Envia emails automaticos de atualizacao de status do rastreio."
3. **Site do rastreio por SMS** - "Envia o link do site de rastreio personalizado ao cliente por SMS."
4. **Funil de Taxacao** - "Ativa o fluxo de taxacao com envio de Email e SMS ao cliente."

## Secao de custo por envio

Atualizar o breakdown para refletir os novos nomes:

```text
NF por email ............. 1 moeda (se ativo)
Rastreio por email ....... 1 moeda (se ativo)
Site rastreio por SMS .... +0,25 moeda (se ativo)
Funil de Taxacao ......... +1 moeda (se ativo)
────────────────────────────────
Total por envio: X moedas
```

## Arquivo a modificar

**`src/pages/Postagens.tsx`** - Apenas renomear labels, descricoes e textos do breakdown de custo. Nenhuma mudanca de logica ou banco de dados.

