import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Missing 'token' query parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return new Response(
        JSON.stringify({ error: "Content-Type must be application/json. Add the header: Content-Type: application/json" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = await req.json();
    const { customer, address, items, total } = payload;

    // Validate required fields with specific error messages
    const errors: string[] = [];

    if (!customer || typeof customer !== "object") {
      errors.push("'customer' object is required");
    } else {
      if (!customer.name || typeof customer.name !== "string" || customer.name.trim().length === 0) {
        errors.push("'customer.name' is required and must be a non-empty string");
      }
      if (!customer.email || typeof customer.email !== "string" || !customer.email.includes("@")) {
        errors.push("'customer.email' is required and must be a valid email");
      }
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      errors.push("'items' is required and must be a non-empty array");
    } else {
      items.forEach((item: any, idx: number) => {
        if (!item.name || typeof item.name !== "string") {
          errors.push(`'items[${idx}].name' is required`);
        }
        if (item.price !== undefined && (typeof item.price !== "number" || item.price < 0)) {
          errors.push(`'items[${idx}].price' must be a positive number`);
        }
        if (item.quantity !== undefined && (typeof item.quantity !== "number" || item.quantity < 1)) {
          errors.push(`'items[${idx}].quantity' must be at least 1`);
        }
      });
    }

    if (total !== undefined && (typeof total !== "number" || total < 0)) {
      errors.push("'total' must be a positive number");
    }

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ error: "Validation failed", details: errors }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Resolve loja by webhook_token
    const { data: lojaData, error: lojaError } = await supabase
      .from("lojas")
      .select("id")
      .eq("webhook_token", token)
      .maybeSingle();

    if (lojaError || !lojaData) {
      return new Response(
        JSON.stringify({ error: "Invalid token. Store not found." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lojaId = lojaData.id;
    const transactionToken = `api_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Calculate total
    const totalValue = total ?? items.reduce((sum: number, i: any) => sum + (parseFloat(String(i.price || 0)) * parseInt(String(i.quantity || 1), 10)), 0);
    const totalCents = Math.round(totalValue * 100);

    const normalizedProducts = items.map((item: any) => ({
      code: item.sku || item.code || "",
      title: item.name,
      quantity: parseInt(String(item.quantity || 1), 10),
      amount: Math.round(parseFloat(String(item.price || 0)) * 100),
    }));

    // 1. Log the webhook
    await supabase.from("webhook_logs").insert({
      checkout_provider: "api_externa",
      event_type: "sale",
      status: "paid",
      payload,
      processed: false,
      loja_id: lojaId,
    });

    // 2. Create pedido
    const pedidoData = {
      checkout_provider: "api_externa",
      transaction_token: transactionToken,
      status: "paid",
      method: payload.method || null,
      total_price: totalCents,
      customer_name: customer.name,
      customer_document: customer.document || null,
      customer_email: customer.email,
      customer_phone: customer.phone || null,
      address_street: address?.street || null,
      address_number: address?.number || null,
      address_district: address?.neighborhood || null,
      address_zip_code: address?.zipcode || null,
      address_city: address?.city || null,
      address_state: address?.state || null,
      address_country: null,
      address_complement: address?.complement || null,
      products: normalizedProducts,
      raw_payload: payload,
      loja_id: lojaId,
    };

    const { data: newPedido, error: pedidoError } = await supabase
      .from("pedidos")
      .insert(pedidoData)
      .select("id")
      .single();

    if (pedidoError || !newPedido) {
      console.error("Error creating pedido:", pedidoError);
      return new Response(
        JSON.stringify({ error: "Failed to create order" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Get empresa
    const { data: empresaData } = await supabase
      .from("empresas")
      .select("id")
      .eq("loja_id", lojaId)
      .maybeSingle();

    // 4. Create envio
    const produtoJson = JSON.stringify(
      normalizedProducts.map((p: any) => ({ nome: p.title, quantidade: p.quantity || 1 }))
    );
    const totalQuantidade = normalizedProducts.reduce((sum: number, p: any) => sum + (p.quantity || 1), 0);

    const envioData = {
      cliente_nome: customer.name,
      cliente_email: customer.email,
      cliente_cpf: customer.document || null,
      cliente_telefone: customer.phone || null,
      cliente_endereco: address?.street || null,
      cliente_numero: address?.number || null,
      cliente_bairro: address?.neighborhood || null,
      cliente_cep: address?.zipcode || null,
      cliente_cidade: address?.city || null,
      cliente_estado: address?.state || null,
      cliente_complemento: address?.complement || null,
      produto: produtoJson,
      quantidade: totalQuantidade,
      valor: totalValue,
      status: "pendente" as const,
      loja_id: lojaId,
      empresa_id: empresaData?.id || null,
    };

    const { data: newEnvio, error: envioError } = await supabase
      .from("envios")
      .insert(envioData)
      .select("id, codigo_rastreio")
      .single();

    if (envioError || !newEnvio) {
      console.error("Error creating envio:", envioError);
      return new Response(
        JSON.stringify({ error: "Failed to create shipment" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Link pedido to envio
    await supabase
      .from("pedidos")
      .update({ envio_id: newEnvio.id })
      .eq("id", newPedido.id);

    // 6. Mark webhook as processed
    await supabase
      .from("webhook_logs")
      .update({ processed: true })
      .eq("checkout_provider", "api_externa")
      .eq("loja_id", lojaId)
      .order("created_at", { ascending: false })
      .limit(1);

    return new Response(
      JSON.stringify({
        success: true,
        pedido_id: newPedido.id,
        envio_id: newEnvio.id,
        codigo_rastreio: newEnvio.codigo_rastreio,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("API External error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
