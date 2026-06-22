// Helper único — todo link de rastreio enviado ao cliente passa por aqui.
// Mantenha sincronizado com src/lib/tracking-url.ts

export type Marca = "jetline" | "atlas" | "trackmaster_us" | "trackmaster_es";

const DOMAINS: Record<Marca, string> = {
  jetline: "https://app.jetlinetransportes.com",
  atlas: "https://app.atlas-cargo.org",
  trackmaster_us: "https://us.tracker-master.com",
  trackmaster_es: "https://es.tracker-master.com",
};

export function resolveMarca(input: {
  marca?: string | null;
  is_international?: boolean | null;
  global_flow_lang?: string | null;
  logistica_provider?: string | null;
  codigo_rastreio?: string | null;
}): Marca {
  if (input.marca && input.marca in DOMAINS) return input.marca as Marca;
  if (input.is_international) {
    return (input.global_flow_lang || "").toLowerCase() === "es"
      ? "trackmaster_es"
      : "trackmaster_us";
  }
  const prov = (input.logistica_provider || "").toLowerCase();
  if (prov === "jetline") return "jetline";
  const code = (input.codigo_rastreio || "").toUpperCase();
  if (code.endsWith("US")) return "trackmaster_us";
  if (code.endsWith("ES")) return "trackmaster_es";
  if (code.endsWith("JL")) return "jetline";
  return "atlas";
}

export function getTrackingBaseUrl(marca: Marca): string {
  return DOMAINS[marca];
}

export function getTrackingUrl(marca: Marca, codigo: string): string {
  return `${DOMAINS[marca]}/r/${codigo}`;
}
