

## Plan: Métrica de clientes únicos afetados (ao invés de total de emails)

### Problema atual
As métricas contam **total de emails com problema** (ex: 230 total). Se um cliente não recebeu 3 etapas (Postado, Coletado, Em Trânsito), conta como 3. O correto seria contar **1 cliente único** com 3 etapas afetadas.

### Alteração

**`src/pages/admin/AdminEmailSaude.tsx`** — Ajustar o `userStats` e a UI:

1. **Adicionar contagem de destinatários únicos** no `useMemo` de `userStats`:
   - Criar um `Set<string>` de `destinatario` por usuário para contar clientes únicos
   - Manter o `total` atual (total de emails) como informação secundária

2. **Ajustar `byEvento`** para também rastrear destinatários únicos por etapa:
   - Cada etapa mostra "X clientes únicos" ao invés de "X problemas"
   - Manter total de registros como detalhe secundário

3. **Atualizar os badges no header do usuário**:
   - Exibir "X clientes afetados" como métrica principal (novo badge)
   - Manter badges de bounced/failed/delivery_delayed com contagem de emails como detalhe

4. **Atualizar o header da tabela expandida**:
   - "Qtd. Clientes Únicos" ao invés de "Qtd. Problemas"

### Estrutura de dados ajustada
```text
byUser entry:
  + uniqueDestinatarios: Set<string>     // clientes únicos afetados
  byEvento:
    + uniqueDestinatarios: Set<string>   // clientes únicos por etapa
    count: number                         // total de registros (mantido)
```

### Visual resultante
```text
mario  |  [83 clientes afetados]  219 bounced  4 failed  7 delivery_delayed  230 emails total
  Postado      → 83 registros / X clientes únicos
  Coletado     → 64 registros / Y clientes únicos
```

### Arquivo alterado
- `src/pages/admin/AdminEmailSaude.tsx` (apenas)

