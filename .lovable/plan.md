## Diagnóstico

A conta `rodrigosantosderesendejunior@gmail.com` (loja **yaveh**) tem o template ativo correto: **"Nacional Falha na Entrega"** (`0cd4b6ef…`). Mas existem três problemas reais:

### 1. 2.463 envios "congelados" com Template Prolongado
Quando ele aplicou "Falha na Entrega" em 25/04, a função `applyTemplate` carimbou TODOS os envios em andamento com o ID do template anterior ("Prolongado"). Resultado: pedidos antigos seguem na timeline de 16 etapas do "Prolongado" mesmo o ativo sendo outro.

**Os pedidos novos de hoje estão corretos** (`postagem_template_id = NULL` → cron usa o ativo "Falha na Entrega"). Mas a UI/timeline pública está mostrando dados confusos por causa do bug #3 abaixo.

### 2. Templates duplicados na conta dele
- 8 cópias do "Template Prolongado"
- 3 cópias de "Nacional Falha na Entrega"
- 2 cópias de "Nacional Taxação"

Cada vez que ele clica "Aplicar Template" na tela de Postagens, a função clona o template do system em vez de reutilizar uma cópia existente. Só uma cópia de cada está realmente em uso.

### 3. Bug em `rastreio-info` (afeta TODAS as lojas)
A edge function `rastreio-info` usa **sempre** `config.template_ativo_id` ao montar a timeline pública, **ignorando o `envio.postagem_template_id` congelado** no envio. Isso significa que pedidos congelados com um template antigo aparecem na página pública de rastreio com a timeline do template ATUAL — desalinhando ordem/nomes/etapas.

### 4. Bug no "freeze" do applyTemplate
A lógica atual carimba envios com `status != 'entregue'` no template antigo. Isso é bom em tese, mas dispara também em pedidos recém-criados (status = pendente, ordem = 0 ou 1) que estariam melhor seguindo o template novo. Resultado: troca de template "para frente" não funciona como o usuário espera.

---

## Plano de correção

### Etapa A — Limpeza de dados da loja yaveh
1. **Descongelar os 2.463 envios** com template "Prolongado": setar `postagem_template_id = NULL` para todos os envios da loja `428f4bb4…` que não estão entregues e cujo template congelado é diferente do ativo. Eles passarão a usar o template ativo ("Falha na Entrega") automaticamente.
2. **Apagar templates duplicados**: manter apenas a cópia em uso de cada tipo (a mais recente / a referenciada por `postagem_config.template_ativo_id`) e apagar as outras 10 cópias órfãs (incluindo seus eventos).

### Etapa B — Corrigir bug do `rastreio-info`
Alterar a função para priorizar `envio.postagem_template_id` quando existir, caindo para `config.template_ativo_id` apenas como fallback. Mesma lógica já existe corretamente em `advance-shipments` e `email-trigger`.

### Etapa C — Corrigir bug do `applyTemplate`
Trocar o comportamento de freeze:
- **Manter freeze** apenas para envios que já avançaram além da etapa inicial (`ultimo_evento_ordem >= 2`), ou seja, que realmente estão em andamento
- **Não congelar** envios pendentes recém-criados — eles seguirão o novo template
- **Reutilizar** cópia existente do template do mesmo `tipo` quando disponível, em vez de sempre clonar uma nova (evita duplicatas no futuro)

### Etapa D — Migração de limpeza global de duplicatas
Aplicar a mesma deduplicação para todas as lojas: para cada `(loja_id, tipo)` com mais de uma cópia não-system, manter apenas a referenciada por `postagem_config.template_ativo_id` (ou a mais recente) e apagar as outras com seus eventos. Isso libera espaço e evita confusão futura em outras contas.

---

## Detalhes técnicos

**Arquivos a editar:**
- `supabase/functions/rastreio-info/index.ts` — usar `envio.postagem_template_id || config.template_ativo_id`
- `src/pages/Postagens.tsx` (`applyTemplate`) — freeze condicional + reuso de template existente

**Migrations a criar:**
1. `UPDATE envios SET postagem_template_id = NULL WHERE loja_id = 'yaveh' AND postagem_template_id <> config.template_ativo_id AND status <> 'entregue' AND deleted_at IS NULL`
2. `DELETE FROM postagem_eventos WHERE template_id IN (...templates_orfaos...)` + `DELETE FROM postagem_templates WHERE id IN (...)` aplicado a todas as lojas

**Sem mudanças em:**
- `advance-shipments` (já usa fallback correto)
- `email-trigger` (já usa fallback correto)
- Webhooks de checkout (já corrigidos no fix anterior)

**Risco:** baixo. Os envios "descongelados" continuarão na ordem em que estavam — só passarão a usar a timeline de 9 etapas do "Falha na Entrega" em vez das 16 do "Prolongado". Como já estavam tratados como Falha pelo cron (que usa o ativo), isso só corrige a UI de rastreio público.
