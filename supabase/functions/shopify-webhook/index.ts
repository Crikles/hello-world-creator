import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { encodeHex } from "https://deno.land/std@0.208.0/encoding/hex.ts";

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
      tipo: 'shopify',
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

    // Generate a placeholder tracking code (since usually dropshipping generates it later)
    // Or save it directly to 'pedidos' table if you prefer.
    const mockCodigo = `SHP${payload.id.toString().substring(0, 8)}BR`;

    await supabase.from("pedidos").insert({
      loja_id: loja.id,
      user_id: loja.user_id,
      cliente_nome: payload.customer?.first_name ? `${payload.customer.first_name} ${payload.customer.last_name || ''}` : "Cliente Shopify",
      cliente_email: email,
      cliente_telefone: phone,
      codigo_rastreio: mockCodigo,
      status: "Pendente",
      produtos: produtos,
      cep_destino: payload.shipping_address?.zip,
      origem: "Shopify"
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
