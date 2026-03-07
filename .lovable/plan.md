

## Plano: Adicionar fluxo completo de Falha na Entrega (3 eventos)

### Situação atual
Falha na Entrega é apenas 1 evento. Ao ativar, o fluxo envia o e-mail de falha e para. Faltam os passos de **Pagamento Confirmado** e **Saiu para Entrega** (reenvio).

### Mudança
Ao ativar "Falha na Entrega", o sistema ativará 3 eventos em sequência:
1. **Falha Entrega** (existente) — notifica o cliente da falha
2. **Reenvio Pago** (novo) — pagamento do reenvio confirmado (e-mail diferente do "Pago" da Taxação)
3. **Reenvio Saiu** (novo) — pedido saiu novamente para entrega

### Alterações

#### 1. Migração SQL — Inserir 2 novos eventos em cada template
Para cada template existente que tem "Falha Entrega", inserir "Reenvio Pago" e "Reenvio Saiu" logo após, reordenando o "Entregue" para ficar por último. Os novos status_labels serão `Reenvio Pago` e `Reenvio Saiu` para não conflitar com Taxação.

#### 2. `src/pages/Postagens.tsx` — Filtro `isEventoAtivo`
Adicionar `Reenvio Pago` e `Reenvio Saiu` ao grupo controlado por `ativar_falha_entrega`:
```typescript
if (["Falha Entrega", "Reenvio Pago", "Reenvio Saiu"].includes(evento.status_label))
  return localConfig.ativar_falha_entrega;
```

Adicionar cores de badge para os novos status.

#### 3. `src/lib/email-trigger.ts` — Filtro de eventos
Estender o filtro para incluir `Reenvio Pago` e `Reenvio Saiu` no grupo falha:
```typescript
const falhaLabels = ["Falha Entrega", "Reenvio Pago", "Reenvio Saiu"];
if (falhaLabels.includes(e.status_label) && !config.ativar_falha_entrega) return false;
```

#### 4. `supabase/functions/advance-shipments/index.ts` — Filtro servidor
Mesma lógica: filtrar `Reenvio Pago` e `Reenvio Saiu` junto com `Falha Entrega` quando desativado.

#### 5. `supabase/functions/send-email/index.ts` — E-mail do Reenvio Pago
- Adicionar cores e títulos para `Reenvio Pago` e `Reenvio Saiu` nos mapas existentes
- O `Reenvio Pago` usará o template genérico (não o de Taxação), com mensagem contextualizada sobre reenvio confirmado
- O `Reenvio Saiu` usará o template genérico de "Saiu para Entrega"

#### 6. `supabase/functions/falha-info/index.ts` — Sem alteração necessária

### Resultado do fluxo
```text
... → Centro Local → Saiu p/ Entrega → [Falha Entrega] → [Reenvio Pago] → [Reenvio Saiu] → Entregue
```
Quando `ativar_falha_entrega = false`, os 3 eventos são omitidos e o fluxo pula direto para Entregue.

### Arquivos alterados
- Migração SQL (novos eventos + reordenação)
- `src/pages/Postagens.tsx`
- `src/lib/email-trigger.ts`
- `supabase/functions/advance-shipments/index.ts`
- `supabase/functions/send-email/index.ts`

