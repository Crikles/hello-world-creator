## Objetivo

Tornar os toggles **Funil de Taxação** e **Falha na Entrega** dependentes do template pré-configurado selecionado. Cada template "carrega" suas próprias features e bloqueia as features dos outros templates.

## Mapeamento template → features

| Template | Liga automaticamente | Bloqueia |
|---|---|---|
| Envio Rápido | nada | Taxação, Falha |
| Envio Prolongado | nada | Taxação, Falha |
| Envio com Taxação | `ativar_taxacao` | Falha |
| Envio com Falha na Entrega | `ativar_falha_entrega` | Taxação |

Os demais toggles (NF-e por email, Rastreio por email, SMS, WhatsApp, Vizinho) continuam livres em qualquer template.

## Comportamento

1. **Ao aplicar um template** (clique no card):
   - Liga o toggle correspondente do template (se houver).
   - Desliga o toggle do template "concorrente" para não ficar com config inválida.
   - Salva junto com `template_ativo_id` na mesma operação.

2. **Toggles bloqueados**:
   - Toggle de Taxação fica desabilitado (cinza, cursor-not-allowed) quando o template ativo não é "Taxação".
   - Toggle de Falha fica desabilitado quando o template ativo não é "Falha na Entrega".
   - Tooltip explicando: *"Disponível apenas no template Envio com Taxação"* (ou Falha na Entrega).

3. **Toggle habilitado mas no template certo**: continua editável normalmente — usuário pode desligar a Taxação mesmo estando no template de Taxação (caso queira pausar temporariamente).

## Arquivos

- `src/pages/Postagens.tsx`
  - Adicionar mapa `TEMPLATE_FEATURE` (por `tipo` do template).
  - Estender a mutation `applyTemplate` para também escrever `ativar_taxacao` e `ativar_falha_entrega` no upsert de `postagem_config`, conforme o mapa.
  - No `featureToggles`, marcar as entradas de Taxação e Falha como `locked` quando o template ativo não corresponder, e renderizá-las desabilitadas com tooltip.

## Detalhe técnico

O `tipo` em `postagem_templates` já distingue cada fluxo (`rapido`, `prolongado`, `taxacao`, `falha`). Vou usar esse campo como chave — não depende do nome nem do UUID.
