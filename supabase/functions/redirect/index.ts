import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("c");
  const paymentId = url.searchParams.get("p");
  const falhaId = url.searchParams.get("f");

  if (!code && !paymentId && !falhaId) {
    return new Response("Missing parameter", { status: 400 });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Detect if this envio belongs to VETOR
    let isVetor = false;

    if (code) {
      // Check suffix first (fast)
      isVetor = code.toUpperCase().trim().endsWith("VT");
      if (!isVetor) {
        // Fallback: check transportadora field
        const { data: envio } = await supabase
          .from("envios")
          .select("transportadora")
          .eq("codigo_rastreio", code.trim().toUpperCase())
          .maybeSingle();
        if (envio?.transportadora?.toUpperCase().includes("VETOR")) {
          isVetor = true;
        }
      }
    } else {
      // paymentId or falhaId — lookup envio by id
      const envioId = paymentId || falhaId;
      const { data: envio } = await supabase
        .from("envios")
        .select("transportadora, codigo_rastreio")
        .eq("id", envioId!)
        .maybeSingle();
      if (envio) {
        isVetor = envio.transportadora?.toUpperCase().includes("VETOR") ||
          (envio.codigo_rastreio?.toUpperCase().trim().endsWith("VT") ?? false);
      }
    }

    let baseUrl: string;
    if (isVetor) {
      baseUrl = "https://vetortransportesltda.com";
    } else {
      // Fetch the current tracking base URL from system_config
      const { data: config } = await supabase
        .from("system_config")
        .select("label")
        .eq("key", "tracking_base_url")
        .single();
      baseUrl = config?.label || "https://rastreio.jltransportelogistica.com";
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
  } catch (error) {
    console.error("Redirect error:", error);
    const fallback = "https://rastreio.jltransportelogistica.com";
    const dest = code ? `${fallback}/r/${code}` : paymentId ? `${fallback}/p/${paymentId}` : `${fallback}/f/${falhaId}`;
    return new Response(null, {
      status: 302,
      headers: { Location: dest },
    });
  }
});
