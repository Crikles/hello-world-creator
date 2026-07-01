/**
 * Format a monetary value with the correct currency symbol.
 * Supported: BRL (R$), USD ($), EUR (€), GBP (£). Fallback: currency code + value.
 */
export function formatMoney(valor: number | string | null | undefined, moeda?: string | null): string {
  const n = Number(valor ?? 0);
  const code = (moeda || "BRL").toUpperCase();

  try {
    switch (code) {
      case "BRL":
        return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case "USD":
        return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case "EUR":
        return `€${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case "GBP":
        return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      default:
        return `${code} ${n.toFixed(2)}`;
    }
  } catch {
    return `${code} ${n.toFixed(2)}`;
  }
}

/** Just the currency symbol for a given ISO code. */
export function currencySymbol(moeda?: string | null): string {
  switch ((moeda || "BRL").toUpperCase()) {
    case "BRL": return "R$";
    case "USD": return "$";
    case "EUR": return "€";
    case "GBP": return "£";
    default: return (moeda || "BRL").toUpperCase();
  }
}
