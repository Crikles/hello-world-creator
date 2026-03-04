

## Plan

### 1. Update "Entregue" delay in all system templates to 10 days

Run a SQL migration to update all system template events where `status_label = 'Entregue'` to have `delay_horas = 240` (10 days x 24 hours).

```sql
UPDATE postagem_eventos 
SET delay_horas = 240
WHERE status_label = 'Entregue' 
AND template_id IN (SELECT id FROM postagem_templates WHERE is_system = true);
```

Currently the values are 0 or 24 hours -- all will become 240 (10 days).

### 2. Add clarifying text about delay meaning

In `src/pages/Postagens.tsx`, update the delay input label area (around line 690-696) to include a small helper text explaining that the days shown are relative to the previous event (e.g., "dias apos o ultimo evento"). This will appear next to the clock icon and day input for each event row.

Also add an informational note below the "Eventos do Fluxo Ativo" heading (around line 622-625) with a subtle description like: "Os dias configurados representam o intervalo a partir do ultimo evento concluido."

### Files changed
- **Database migration**: Update `delay_horas` for all system "Entregue" events to 240
- **`src/pages/Postagens.tsx`**: Add helper text clarifying delay is relative to last event

