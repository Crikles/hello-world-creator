import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PROVIDER_BASE_URLS: Record<string, string> = {
  vetor: "https://vetortransportesltda.com",
  atlas: "https://atlas-cargo.org",
  jl: "https://rastreio.jltransportelogistica.com",
};

const DEFAULT_BASE_URL = PROVIDER_BASE_URLS.atlas;

function providerFromSuffix(code: string | null): string | null {
  if (!code) return null;
  const c = code.toUpperCase().trim();
  if (c.endsWith("VT")) return "vetor";
  if (c.endsWith("AT")) return "atlas";
  if (c.endsWith("JL")) return "jl";
  return null;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("c");
  const paymentId = url.searchParams.get("p");
  const falhaId = url.searchParams.get("f");

  if (!code && !paymentId && !falhaId) {
    return new Response("Missing parameter", { status: 400 });
  }

  let baseUrl = DEFAULT_BASE_URL;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let provider: string | null = providerFromSuffix(code);
    let lojaId: string | null = null;
    let transportadora: string | null = null;

    if (code) {
      const { data: envio } = await supabase
        .from("envios")
        .select("loja_id, transportadora")
        .eq("codigo_rastreio", code.trim().toUpperCase())
        .maybeSingle();
      if (envio) {
        lojaId = envio.loja_id ?? null;
        transportadora = envio.transportadora ?? null;
      }
    } else {
      const envioId = paymentId || falhaId;
      const { data: envio } = await supabase
        .from("envios")
        .select("loja_id, transportadora, codigo_rastreio")
        .eq("id", envioId!)
        .maybeSingle();
      if (envio) {
        lojaId = envio.loja_id ?? null;
        transportadora = envio.transportadora ?? null;
        provider = provider || providerFromSuffix(envio.codigo_rastreio);
      }
    }

    // Provider definitivo vem da loja, quando disponível
    if (lojaId) {
      const { data: loja } = await supabase
        .from("lojas")
        .select("logistica_provider")
        .eq("id", lojaId)
        .maybeSingle();
      if (loja?.logistica_provider) {
        provider = loja.logistica_provider;
      }
    }

    // Fallback adicional pela transportadora textual
    if (!provider && transportadora) {
      const t = transportadora.toUpperCase();
      if (t.includes("VETOR")) provider = "vetor";
      else if (t.includes("ATLAS")) provider = "atlas";
      else if (t.includes("JL")) provider = "jl";
    }

    baseUrl = (provider && PROVIDER_BASE_URLS[provider]) || DEFAULT_BASE_URL;
  } catch (error) {
    console.error("Redirect lookup error:", error);
    baseUrl = DEFAULT_BASE_URL;
  }

  let destination: string;
  if (code) {
    destination = `${baseUrl}/r/${code}`;
  } else if (falhaId) {
    destination = `${baseUrl}/f/${falhaId}`;
  } else {
    destination = `${baseUrl}/p/${paymentId}`;
  }

  return new Response(null, {
    status: 302,
    headers: { Location: destination },
  });
});
