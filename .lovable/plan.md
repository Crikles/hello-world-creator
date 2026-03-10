

# Fix: Envios existentes não devem ser afetados por mudança de template

## Problema

Quando o usuário muda o template ativo em Postagens, os envios que já estão em progresso (ex: etapa 8/9) são afetados porque:

1. **Progresso visual (Envios.tsx)**: O cálculo de `totalEventos` sempre usa `config.template_ativo_id` — o template ATUAL da loja. Se o template muda de 9 para 12 eventos, o envio que estava em 8/9 passa a mostrar 8/12.

2. **Avanço automático (advance-shipments + email-trigger)**: Usam `shipment.postagem_template_id || config.template_ativo_id`. Envios que já têm `postagem_template_id` gravado estão protegidos, mas envios antigos (antes dessa coluna existir) caem no fallback e pegam o template novo.

## Solução

### 1. Backfill: Gravar `postagem_template_id` nos envios antigos
Criar uma migração SQL que preencha `postagem_template_id` em todos os envios que ainda não têm, usando o `template_ativo_id` atual da loja. Isso "congela" o template para envios existentes.

```sql
UPDATE envios e
SET postagem_template_id = pc.template_ativo_id
FROM postagem_config pc
WHERE e.loja_id = pc.loja_id
  AND e.postagem_template_id IS NULL
  AND pc.template_ativo_id IS NOT NULL;
```

### 2. Corrigir cálculo de progresso em Envios.tsx (linhas ~177-202)
Em vez de usar `config.template_ativo_id` para TODOS os envios, calcular o total de eventos **por envio** usando o `postagem_template_id` de cada um. Approach: buscar os eventos do template do envio individualmente, ou agrupar envios por template_id.

Simplificação prática: como cada envio já tem `postagem_template_id`, fazer o cálculo de progresso inline por envio em vez de usar um único `totalEventos` global.

### 3. Garantir que nunca mais um envio fique sem template
Verificar que `NovoEnvioWizard.tsx` e `ImportarPlanilha.tsx` já gravam `postagem_template_id` (já fazem — confirmado no código).

## Arquivos a alterar

| Arquivo | Mudança |
|---------|---------|
| Migração SQL | Backfill `postagem_template_id` nos envios existentes |
| `src/pages/Envios.tsx` | Calcular progresso por envio usando seu próprio `postagem_template_id` em vez do template ativo global |
| `src/pages/Taxacao.tsx` | Mesmo ajuste — usar template do envio quando aplicável |

