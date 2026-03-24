

## Plan: Add Payment Method Filter to Envios

### What
Add a new dropdown filter next to the existing "Todos Status" filter that lets users filter shipments by payment method: **Todos Pagamentos**, **PIX**, **Cartão**, or **Checkout** (all checkout-originating orders).

### Changes (single file: `src/pages/Envios.tsx`)

1. **Add state** for the new filter:
   ```typescript
   const [filterMetodo, setFilterMetodo] = useState<string>("todos");
   ```

2. **Add filter logic** in `filteredEnvios` alongside the existing `matchStatus` and `matchDate`:
   - `"todos"` → no filter
   - `"pix"` → only envios where `pedidoMetodoMap[e.id]` contains "pix"
   - `"cartao"` → only envios where `pedidoMetodoMap[e.id]` contains "card/cartao/cartão/credit"
   - `"checkout"` → only envios that have an entry in `pedidoOrigemMap` (i.e., came from a checkout integration)
   - `"manual"` → only envios without an entry in `pedidoOrigemMap`

3. **Add Select dropdown** right after the status filter, using the same style (`w-[160px] h-8 text-xs bg-transparent border-border/50`):
   ```
   Todos Pagamentos | PIX | Cartão | Boleto | Checkout | Manual
   ```

4. **Reset page** when `filterMetodo` changes (add to existing `useEffect` that resets `currentPage`).

### Technical Details
- Reuses the existing `pedidoMetodoMap` data (already fetched from `pedidos` table) — no new queries needed.
- Uses the same `getMetodoLabel` normalization logic already in the codebase to match PIX/Cartão/Boleto.
- Filter is purely client-side, matching the pattern of the status and date filters.

