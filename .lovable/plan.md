

## Plan: Remove JADLOG Option & Migrate Users to VETOR

### What
1. Remove JADLOG as a selectable logistics provider for future shipments
2. Migrate all stores currently using JADLOG (`logistica_provider = 'jadlog'`) to VETOR
3. Keep existing JADLOG shipments untouched (their `transportadora` and `codigo_rastreio` remain as-is, so branding on tracking pages still works)

### How

**1. Database migration — Transfer all JADLOG stores to VETOR**

Run SQL via migration tool:
```sql
UPDATE lojas SET logistica_provider = 'vetor' WHERE logistica_provider = 'jadlog';
```

This changes the default provider for future shipments only. Existing `envios` rows keep their `transportadora = 'JADLOG Logística'` and `JD` suffix codes.

**2. Update `src/pages/Postagens.tsx` — Remove JADLOG card**

- Remove the JADLOG button from the `LogisticaTab` grid (lines 927-937)
- Change grid from `grid-cols-3` to `grid-cols-2`
- Update the mutation type from `"jl" | "jadlog" | "vetor"` to `"jl" | "vetor"`
- Update `activeLabel` to remove the jadlog case (fallback any residual jadlog to "Vetor Transportes")

**3. Update `generate_tracking_code()` DB function**

Update the function so that if somehow `logistica_provider = 'jadlog'` still exists, it falls back to VETOR suffix (`VT`) instead of `JD`. This is a safety net.

### What stays unchanged
- All existing JADLOG shipments keep their branding (tracking page, emails, badges in Envios list)
- The `isJadlog()` detection in `Envios.tsx`, `Rastreio.tsx`, `send-email`, and `PushNotificationPrompt` remain — they display correctly for historical shipments
- No data is lost

