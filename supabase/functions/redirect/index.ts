// Redireciona link curto para o domínio correto da marca do envio/pedido.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getTrackingBaseUrl, getTrackingUrl, resolveMarca } from "../_shared/tracking-url.ts";

const FALLBACK_BASE = "https://app.atlas-cargo.org";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("c");
  const paymentId = url.searchParams.get("p");
  const falhaId = url.searchParams.get("f");

  if (!code && !paymentId && !falhaId) {
    return new Response("Missing parameter", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let destination: string = FALLBACK_BASE;

  try {
    if (code) {
      const { data: envio } = await supabase
        .from("envios")
        .select("marca, is_international, global_flow_lang, codigo_rastreio, loja_id")
        .eq("codigo_rastreio", code.toUpperCase())
        .maybeSingle();
      let provider: string | null = null;
      if (envio?.loja_id) {
        const { data: loja } = await supabase
          .from("lojas").select("logistica_provider").eq("id", envio.loja_id).maybeSingle();
        provider = loja?.logistica_provider || null;
      }
      const marca = resolveMarca({
        marca: envio?.marca,
        is_international: envio?.is_international,
        global_flow_lang: envio?.global_flow_lang,
        logistica_provider: provider,
        codigo_rastreio: code,
      });
      destination = getTrackingUrl(marca, code);
    } else {
      // p/ falha e pagamento: tenta achar o envio pelo id
      const targetId = (falhaId || paymentId)!;
      const { data: envio } = await supabase
        .from("envios")
        .select("marca, is_international, global_flow_lang, loja_id, codigo_rastreio")
        .eq("id", targetId)
        .maybeSingle();
      let provider: string | null = null;
      if (envio?.loja_id) {
        const { data: loja } = await supabase
          .from("lojas").select("logistica_provider").eq("id", envio.loja_id).maybeSingle();
        provider = loja?.logistica_provider || null;
      }
      const marca = resolveMarca({
        marca: envio?.marca,
        is_international: envio?.is_international,
        global_flow_lang: envio?.global_flow_lang,
        logistica_provider: provider,
        codigo_rastreio: envio?.codigo_rastreio,
      });
      const base = getTrackingBaseUrl(marca);
      destination = falhaId ? `${base}/f/${targetId}` : `${base}/p/${targetId}`;
    }
  } catch (err) {
    console.error("[redirect] lookup error:", err);
  }

  return new Response(null, {
    status: 302,
    headers: { Location: destination },
  });
});
