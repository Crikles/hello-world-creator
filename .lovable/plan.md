

# Fix: Always show company branding on payment and failed delivery pages

## Problem
The `pagamento-info` and `falha-info` edge functions only fetch company data when `envio.empresa_id` is present on the shipment record. Many shipments (created via webhooks or imports) don't have `empresa_id` set, so `empresa` returns `null` and the pages fall back to generic "Logística JL Transportes" branding instead of showing the user's registered company.

## Root Cause
Both edge functions have this pattern:
```typescript
if (envio.empresa_id) {
    // fetch empresa by empresa_id
}
// NO fallback when empresa_id is null
```

The `empresas` table has a `loja_id` column, so we can always look up the company by `loja_id` as a fallback.

## Fix

### 1. Update `supabase/functions/pagamento-info/index.ts`
Add fallback: if `empresa_id` is null or returns no data, query `empresas` table by `envio.loja_id`.

### 2. Update `supabase/functions/falha-info/index.ts`
Same fallback logic: try `empresa_id` first, then fall back to `loja_id`.

### 3. Deploy both edge functions

The change in each function is approximately:
```typescript
let empresa = null;
if (envio.empresa_id) {
    const { data } = await supabase
        .from("empresas")
        .select("nome_fantasia, razao_social, logo_url")
        .eq("id", envio.empresa_id)
        .maybeSingle();
    empresa = data;
}
// Fallback: fetch by loja_id
if (!empresa && envio.loja_id) {
    const { data } = await supabase
        .from("empresas")
        .select("nome_fantasia, razao_social, logo_url")
        .eq("loja_id", envio.loja_id)
        .maybeSingle();
    empresa = data;
}
```

No database changes needed. Two edge function edits + deploy.

