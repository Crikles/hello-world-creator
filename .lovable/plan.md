

## Plan: Add "Exportar Pedidos" (Export Orders) Button to Envios Page

### What it does
Adds a "Exportar" button next to "Importar Planilha" that downloads a CSV file containing all filtered shipments with: client name, email, phone, product, value, tracking code, tracking URL, status, and creation date.

### Changes

**1. Add export function and button in `src/pages/Envios.tsx`**

- Add a `Download` icon import from lucide-react
- Create `handleExportCSV` function that:
  - Takes the current `filteredEnvios` array (respects active filters/search)
  - For each envio, builds the tracking URL using `getTrackingDomain(envio)` + `/rastreio?codigo=` + `codigo_rastreio`
  - Generates a CSV with columns: `Nome`, `Email`, `Telefone`, `Produto`, `Valor`, `Código Rastreio`, `Link Rastreio`, `Status`, `Data`
  - Triggers a browser download of the CSV file with BOM for Excel compatibility
- Place the button between the origin filter and "Importar Planilha", styled consistently (small, outline)

### What stays unchanged
- All existing filters, pagination, and shipment logic
- Import functionality
- No backend changes needed

