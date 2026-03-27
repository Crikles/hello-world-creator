

## Plan: Preview do email com logo e nome real da empresa do usuário

### Problema
1. O preview usa `dadosExemplo` com "Minha Loja" hardcoded e sem `empresa_logo_url`
2. A função `replaceVariables` não processa a sintaxe condicional `{{#empresa_logo_url}}...{{/empresa_logo_url}}`, resultando em texto cru visível no preview

### Alterações

**1. `src/pages/Upsell.tsx` — Buscar dados da empresa e usar no preview**
- Adicionar query para buscar `empresas` da loja atual (`nome_fantasia`, `razao_social`, `logo_url`)
- No `FullEmailPreview`, substituir `dadosExemplo` por um objeto mesclado que inclui:
  - `empresa_nome`: `nome_fantasia || razao_social || "Minha Loja"`
  - `empresa_logo_url`: `logo_url || ""`
- Passar esse objeto para `replaceVariables`

**2. `src/components/postagens/emailTemplates.ts` — Processar condicionais mustache**
- Atualizar `replaceVariables` (ou criar helper) para processar `{{#key}}...{{/key}}`:
  - Se o valor da variável existe e não é vazio → manter o conteúdo entre as tags
  - Se vazio/undefined → remover o bloco inteiro (incluindo as tags)
- Isso garante que se não houver logo, a seção inteira do logo é removida limpamente

### Resultado
- Cada usuário verá sua própria logo (circular, com sombra) e nome da empresa no preview
- Sem logo configurada → seção do logo some do preview (sem texto cru)
- Funciona independentemente por conta/loja

### O que não muda
- `buildEmailHtml` (template HTML intacto)
- Backend `send-email` (já busca dados reais da empresa)
- Formulário de configuração do upsell

