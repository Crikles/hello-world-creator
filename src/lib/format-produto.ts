/**
 * Decode common HTML entities in product names from checkout platforms.
 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

/**
 * Format the `produto` field (JSON array string or plain text) for display.
 */
export function formatProduto(raw: string | null): string {
  if (!raw) return "—";
  try {
    const items = JSON.parse(raw);
    if (Array.isArray(items)) {
      return items
        .map((i: any) => {
          const name = decodeHtmlEntities(i.name || i.nome || i.title || "Produto");
          const qty = i.quantity || i.quantidade || 1;
          return qty > 1 ? `${name} (x${qty})` : name;
        })
        .join(", ");
    }
  } catch {
    // not JSON, return decoded raw
  }
  return decodeHtmlEntities(raw);
}
