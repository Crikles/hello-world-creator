

# Postagens - Novo Modelo de Precificacao por Moedas

## Resumo

Reestruturar o sistema de custos e configuracoes da pagina Postagens para refletir o novo modelo de precificacao baseado em moedas, com opcoes modulares que o usuario pode ativar/desativar.

---

## Novo Modelo de Precos

| Funcionalidade | Custo |
|---|---|
| NF + Emails (fluxo padrao completo) | 1 moeda |
| Codigo de Rastreio | 1 moeda |
| Site de Rastreio (envio do link) | +0,25 moeda |
| Funil de Taxacao (Email + SMS) | +1 moeda |

**Custo base:** 2 moedas (NF+Emails + Rastreio)
**Custo maximo:** 3,25 moedas (base + site rastreio + taxacao)

---

## Mudancas na Interface

### 1. Secao "Configuracoes Gerais" - Novos toggles modulares

Substituir os toggles atuais por:

- **NF + Emails de rastreamento** (sempre ativo, 1 moeda) - Toggle principal do fluxo de emails. Descricao: "Envia a Nota Fiscal e todos os emails de atualizacao de status automaticamente."
- **Codigo de Rastreio** (1 moeda) - Toggle para gerar/enviar codigo de rastreio. Descricao: "Gera e envia o codigo de rastreio ao cliente."
- **Site de Rastreio** (+0,25 moeda) - Toggle para enviar link do site de rastreio. Descricao: "Envia o link do site de rastreio personalizado ao cliente. (em breve)"
- **Funil de Taxacao** (+1 moeda) - Toggle para ativar fluxo de taxacao com Email + SMS. Descricao: "Ativa o fluxo de taxacao com envio de Email e SMS ao cliente. (em breve)"

### 2. Secao "Custo por Envio" - Atualizar calculo

Substituir o calculo antigo (R$ 0,15 por email) pelo novo modelo de moedas:

Mostrar breakdown dinamico baseado nos toggles ativos:
```
NF + Emails .............. 1 moeda
Rastreio ................. 1 moeda
Site de Rastreio ......... +0,25 moeda (se ativo)
Funil de Taxacao ......... +1 moeda (se ativo)
─────────────────────────────────
Total por envio: X moedas
```

### 3. Remover referencia a R$ 0,15

Todas as referencias ao custo de R$ 0,15 por email serao removidas e substituidas pelo modelo de moedas.

---

## Banco de Dados

### Adicionar colunas na tabela `postagem_config`

Duas novas colunas booleanas:

- `ativar_site_rastreio` (boolean, default false) - toggle do site de rastreio
- `ativar_taxacao` (boolean, default false) - toggle do funil de taxacao

As colunas existentes `enviar_nfe_email` e `enviar_emails` serao reaproveitadas:
- `enviar_nfe_email` -> representara "NF + Emails" (toggle principal)
- `enviar_emails` -> representara "Codigo de Rastreio"

---

## Arquivos a Modificar

### `src/pages/Postagens.tsx`
- Atualizar interface `PostagemConfig` com novos campos
- Reestruturar secao de Configuracoes Gerais com 4 toggles
- Atualizar secao de custo estimado para usar moedas
- Adicionar logica de calculo dinamico do custo total
- Remover todas as referencias a R$ 0,15

### Migracao SQL
- Adicionar colunas `ativar_site_rastreio` e `ativar_taxacao` na tabela `postagem_config`

---

## Detalhes Tecnicos

- Os toggles "Site de Rastreio" e "Funil de Taxacao" ficarao visiveis mas com badge "(em breve)" pois serao implementados posteriormente
- O calculo de custo sera feito no frontend: `custoTotal = 1 (NF+Emails) + 1 (Rastreio) + (siteRastreio ? 0.25 : 0) + (taxacao ? 1 : 0)`
- A mutation `toggleConfig` sera estendida para suportar os novos campos

