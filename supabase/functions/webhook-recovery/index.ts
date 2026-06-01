import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NormalizedLead {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  products: { name: string; value: number; qty: number }[];
  total_value: number;
  checkout_url: string;
}

// deno-lint-ignore no-explicit-any
function normalizePayload(payload: any): NormalizedLead | null {
  const customer = payload.customer || payload.Customer || payload.cliente || {};
  const name = customer.name || customer.Name || customer.nome || payload.customer_name || payload.nome || "";
  const email = customer.email || customer.Email || payload.customer_email || payload.email || "";
  const phone = customer.phone || customer.Phone || customer.telefone || payload.customer_phone || payload.telefone || "";

  if (!email) return null;

  let products: { name: string; value: number; qty: number }[] = [];
  const rawProducts = payload.products || payload.Products || payload.items || payload.line_items || payload.produtos || [];

  if (Array.isArray(rawProducts)) {
    products = rawProducts.map((p: Record<string, unknown>) => ({
      name: (p.name || p.Name || p.title || p.nome || "Produto") as string,
      value: Number(p.price || p.Price || p.value || p.valor || 0),
      qty: Number(p.quantity || p.Quantity || p.qty || p.quantidade || 1),
    }));
  }

  let total = Number(payload.total || payload.total_price || payload.valor_total || payload.amount || 0);
  if (!total && products.length > 0) {
    total = products.reduce((s, p) => s + p.value * p.qty, 0);
  }
  if (total > 100000) total = total / 100;

  const checkoutUrl = payload.checkout_url || payload.checkoutUrl || payload.payment_url || payload.link || "";

  return {
    customer_name: name,
    customer_email: email,
    customer_phone: phone,
    products,
    total_value: total,
    checkout_url: checkoutUrl,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const tipo = url.searchParams.get("tipo") || "carrinho";

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing 'token' query parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["carrinho", "pix_pendente"].includes(tipo)) {
      return new Response(JSON.stringify({ error: "Invalid 'tipo'. Use 'carrinho' or 'pix_pendente'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Resolve loja
    const { data: lojaData, error: lojaError } = await supabase
      .from("lojas")
      .select("id, user_id")
      .eq("webhook_token", token)
      .maybeSingle();

    if (lojaError || !lojaData) {
      return new Response(JSON.stringify({ error: "Loja not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lojaId = lojaData.id;

    // Check if recovery is active for this tipo
    const { data: config } = await supabase
      .from("recovery_config")
      .select("ativo, delay_minutos")
      .eq("loja_id", lojaId)
      .eq("tipo", tipo)
      .maybeSingle();

    if (!config?.ativo) {
      return new Response(JSON.stringify({ ok: true, message: "Recovery disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize
    const lead = normalizePayload(payload);
    if (!lead) {
      return new Response(JSON.stringify({ error: "Could not extract email from payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduplication removed: every event creates a new lead

    // Insert lead
    const { data: insertedLead, error: insertError } = await supabase
      .from("recovery_leads")
      .insert({
        loja_id: lojaId,
        customer_name: lead.customer_name,
        customer_email: lead.customer_email,
        customer_phone: lead.customer_phone,
        products: lead.products,
        total_value: lead.total_value,
        checkout_url: lead.checkout_url,
        raw_payload: payload,
        status: "pendente",
        tipo,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save lead" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const leadId = insertedLead.id;

    // Trigger email + SMS instantly (fire-and-forget)
    try {
      await supabase.functions.invoke("send-recovery-email", {
        body: { loja_id: lojaId, customer_email: lead.customer_email, tipo },
      });
    } catch (e) {
      console.error("Failed to invoke send-recovery-email:", e);
    }

    try {
      await supabase.functions.invoke("send-recovery-sms", {
        body: { lead_id: leadId, loja_id: lojaId, tipo },
      });
    } catch (e) {
      console.error("Failed to invoke send-recovery-sms:", e);
    }

    return new Response(JSON.stringify({ ok: true, message: "Lead captured", lead_id: leadId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("webhook-recovery error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
