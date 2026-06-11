// Public endpoint for the embeddable tracking widget.
// Given { loja_id, numero_pedido, email }, returns the codigo_rastreio
// of the matching shipment (only if the order belongs to that loja AND
// the email matches). Used by /widget/tracking.js.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function normalizeEmail(e: string): string {
  return (e || "").trim().toLowerCase();
}

function normalizeOrder(n: string): string {
  return (n || "").trim().replace(/^#/, "").toUpperCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const loja_id = url.searchParams.get("loja_id") || "";
    const numero = normalizeOrder(url.searchParams.get("numero") || "");
    const email = normalizeEmail(url.searchParams.get("email") || "");

    if (!loja_id || loja_id.length < 10) {
      return new Response(
        JSON.stringify({ error: "loja_id inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!numero || !email) {
      return new Response(
        JSON.stringify({ error: "Informe número do pedido e e-mail" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Check widget is enabled for this loja
    const { data: cfg } = await supabase
      .from("postagem_config")
      .select("widget_rastreio_ativo")
      .eq("loja_id", loja_id)
      .maybeSingle();

    if (cfg && cfg.widget_rastreio_ativo === false) {
      return new Response(
        JSON.stringify({ error: "Widget desativado para esta loja" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Try matching against pedidos table: transaction_token OR last chars of id
    const { data: pedidos } = await supabase
      .from("pedidos")
      .select("id, transaction_token, customer_email, envio_id")
      .eq("loja_id", loja_id)
      .or(`transaction_token.ilike.${numero},transaction_token.ilike.%${numero}`)
      .limit(20);

    let matched: { envio_id: string | null; customer_email: string | null } | null = null;
    for (const p of pedidos || []) {
      const pe = normalizeEmail(p.customer_email || "");
      if (pe && pe === email && p.envio_id) {
        matched = p as any;
        break;
      }
    }

    // Fallback: maybe the "numero" is actually a partial id
    if (!matched) {
      const { data: byId } = await supabase
        .from("pedidos")
        .select("id, customer_email, envio_id")
        .eq("loja_id", loja_id)
        .ilike("id", `%${numero.toLowerCase()}%`)
        .limit(10);
      for (const p of byId || []) {
        const pe = normalizeEmail(p.customer_email || "");
        if (pe && pe === email && p.envio_id) {
          matched = p as any;
          break;
        }
      }
    }

    // Last fallback: search directly on envios by id suffix + cliente_email
    if (!matched) {
      const { data: envios } = await supabase
        .from("envios")
        .select("id, cliente_email, codigo_rastreio")
        .eq("loja_id", loja_id)
        .ilike("cliente_email", email)
        .limit(20);
      for (const e of envios || []) {
        if ((e.id as string).toLowerCase().includes(numero.toLowerCase()) ||
            (e.codigo_rastreio || "").toUpperCase().includes(numero)) {
          return new Response(
            JSON.stringify({ codigo_rastreio: e.codigo_rastreio }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    }

    if (!matched || !matched.envio_id) {
      return new Response(
        JSON.stringify({ error: "Pedido não encontrado. Verifique o número e o e-mail." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: envio } = await supabase
      .from("envios")
      .select("codigo_rastreio")
      .eq("id", matched.envio_id)
      .maybeSingle();

    if (!envio?.codigo_rastreio) {
      return new Response(
        JSON.stringify({ error: "Rastreio ainda não disponível para este pedido." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ codigo_rastreio: envio.codigo_rastreio }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("widget-buscar-pedido error:", err);
    const msg = err instanceof Error ? err.message : "Erro interno";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
