import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function verifyShopifyWebhook(rawBody: string, hmacHeader: string, clientSecret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(clientSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const hash = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return hash === hmacHeader;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const lojaSlug = url.searchParams.get("loja");

    if (!lojaSlug) {
      return new Response("Missing loja parameter", { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get integration config using loja slug
    const { data: loja } = await supabase.from('lojas').select('id, user_id').eq('slug', lojaSlug).single();

    if (!loja) return new Response("Loja not found", { status: 404 });

    const { data: config } = await supabase
      .from('shopify_integrations')
      .select('*')
      .eq('loja_id', loja.id)
      .single();

    if (!config) return new Response("Integration not configured", { status: 404 });

    const hmacHeader = req.headers.get("x-shopify-hmac-sha256");
    const rawBody = await req.text();

    if (hmacHeader) {
      const isValid = await verifyShopifyWebhook(rawBody, hmacHeader, config.client_secret);
      if (!isValid) {
        console.error("Invalid Shopify HMAC Signature");
        return new Response("Invalid signature", { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody);

    // Record the webhook hit
    await supabase.from('webhook_logs').insert({
      loja_id: loja.id,
      checkout_provider: 'shopify',
      event_type: 'orders/paid',
      payload: payload,
      status: 'success'
    });

    // Extract Order details
    const email = payload.email || payload.customer?.email;
    const phone = payload.phone || payload.customer?.phone;
    const items = payload.line_items || [];

    const produtos = items.map((i: any) => ({
      nome: i.title,
      quantidade: i.quantity,
      preco: parseFloat(i.price)
    }));

    const customerName = payload.customer?.first_name
      ? `${payload.customer.first_name} ${payload.customer.last_name || ''}`.trim()
      : "Cliente Shopify";

    const totalPrice = Math.round(parseFloat(payload.total_price || "0") * 100);

    // Create pedido
    await supabase.from("pedidos").insert({
      loja_id: loja.id,
      checkout_provider: "shopify",
      transaction_token: String(payload.id || payload.order_number || ""),
      status: "approved",
      total_price: totalPrice,
      customer_name: customerName,
      customer_email: email,
      customer_phone: phone,
      customer_document: null,
      products: produtos,
      raw_payload: payload,
      address_street: payload.shipping_address?.address1,
      address_number: payload.shipping_address?.address2,
      address_district: null,
      address_zip_code: payload.shipping_address?.zip,
      address_city: payload.shipping_address?.city,
      address_state: payload.shipping_address?.province_code,
      address_country: payload.shipping_address?.country_code,
    });

    // Create envio
    await supabase.from("envios").insert({
      loja_id: loja.id,
      cliente_nome: customerName,
      cliente_email: email || "sem-email@shopify.com",
      cliente_telefone: phone,
      cliente_cep: payload.shipping_address?.zip,
      cliente_endereco: payload.shipping_address?.address1,
      cliente_cidade: payload.shipping_address?.city,
      cliente_estado: payload.shipping_address?.province_code,
      produto: items.map((i: any) => i.title).join(", ") || "Produto Shopify",
      valor: parseFloat(payload.total_price || "0"),
      quantidade: items.reduce((sum: number, i: any) => sum + (i.quantity || 1), 0),
      status: "pendente",
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("Webhook Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
