

## Plan: Corrigir mapeamento de templates ativos para todos os usuários

### Problema
1. **Usuários com "Nacional Padrão" antigo (9 eventos com Falha)**: O `tipo` deles é `padrao`, então o badge "ATIVO" aparece no card "Nacional Padrão" (que agora tem 6 eventos), mas os eventos exibidos abaixo são 9 — inconsistência visual.
2. **Usuários com "Nacional Expressa" (3 eventos)**: O template de sistema foi deletado, então nenhum card mostra "ATIVO" — o fluxo funciona mas a UI fica confusa.

### Dados reais encontrados
- **3 lojas** usam cópias de "Nacional Expressa" (Magnus, Mega Loja, Mercado livre) — `tipo = 'expressa'`
- **~15 lojas** usam cópias de "Nacional Padrão" com 9 eventos (incluindo Falha) — `tipo = 'padrao'`
- **1 loja** (My loja) já usa "Nacional Falha na Entrega" corretamente — `tipo = 'falha_entrega'`

### Solução

**1. Migração SQL — reclassificar templates de usuário existentes**

- Templates com `tipo = 'padrao'` que **contêm** eventos "Falha Entrega" → atualizar para `tipo = 'falha_entrega'` e `nome = 'Nacional Falha na Entrega'`
- Templates com `tipo = 'padrao'` que **não contêm** "Falha Entrega" → manter como estão (já corretos com 6 eventos)
- Templates com `tipo = 'expressa'` → não há mais template de sistema correspondente. Opções:
  - Manter funcionando (envios existentes usam o template congelado)
  - O card simplesmente não mostra "ATIVO" em nenhum system template — aceitável

```sql
-- Reclassificar cópias do antigo Padrão que têm eventos de Falha
UPDATE postagem_templates pt
SET tipo = 'falha_entrega', nome = 'Nacional Falha na Entrega'
WHERE pt.is_system = false
  AND pt.tipo = 'padrao'
  AND EXISTS (
    SELECT 1 FROM postagem_eventos pe 
    WHERE pe.template_id = pt.id 
    AND pe.status_label = 'Falha Entrega'
  );
```

**2. Nenhuma alteração de código frontend necessária**
A lógica `activeTemplate?.tipo === template.tipo` já funciona corretamente — após a migração, os templates com falha terão `tipo = 'falha_entrega'` e vão alinhar com o card correto.

### O que não muda
- Templates de envios já em trânsito (congelados por `postagem_template_id`)
- Lojas com "Expressa" continuam funcionando, apenas sem badge "ATIVO" na UI (podem aplicar um novo template quando quiserem)
- Lógica de avanço, emails, rastreio

