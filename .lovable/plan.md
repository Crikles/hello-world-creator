

## Plan: Show Customer Phone Number in Shipment List

### What
Add the customer's phone number below their email in the shipment listing on the Envios page. No database changes needed — `cliente_telefone` already exists in the `envios` table and is already being fetched.

### How

**File: `src/pages/Envios.tsx`**

On line 1045, after the email line, add the phone number display:

```tsx
<div className="min-w-0 w-32 md:w-40 shrink-0">
  <p className="text-sm font-medium text-foreground truncate leading-tight">{envio.cliente_nome}</p>
  <p className="text-[10px] text-muted-foreground truncate">{envio.cliente_email}</p>
  {envio.cliente_telefone && (
    <p className="text-[10px] text-muted-foreground truncate">{envio.cliente_telefone}</p>
  )}
</div>
```

This will show the phone for all shipments (old and new) that have `cliente_telefone` populated. No backfill is needed since the data comes from the original shipment creation.

