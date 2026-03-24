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
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing 'token' query parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();

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
      return new Response(JSON.stringify({ error: "Loja not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lojaId = lojaData.id;

    const status = payload.status || "";
    const isAbandonedCart = status === "abandoned_cart";
    const eventType = isAbandonedCart ? "abandoned_cart" : "sale";

    const transactionToken = isAbandonedCart
      ? payload.abandoned_cart_code || payload.checkout_id || `ac_${Date.now()}`
      : payload.transaction_token || payload.transaction_id || `tx_${Date.now()}`;

    // 2. Normalize customer data
    const customer = payload.customer || {};
    const address = payload.address || {};
    const products = payload.products || [];

    // Extract products: V2 uses payload.products, V1 uses payload.plans[].products[]
    let normalizedProducts = products;
    if (!products.length && payload.plans) {
      normalizedProducts = [];
      for (const plan of payload.plans) {
        if (plan.products) {
          for (const p of plan.products) {
            normalizedProducts.push({
              code: p.id,
              title: p.name,
              description: p.description,
              amount: parseInt(String(p.value || plan.value || 0).replace(".", ""), 10) || 0,
              quantity: parseInt(String(p.amount || "1"), 10),
            });
          }
        }
      }
    }

    let totalPrice = 0;
    const rawPrice = payload.total_price;
    if (rawPrice != null) {
      const priceStr = String(rawPrice);
      if (priceStr.includes(".")) {
        totalPrice = Math.round(parseFloat(priceStr) * 100);
      } else {
        totalPrice = parseInt(priceStr, 10) || 0;
      }
    }

    // 3. Upsert into pedidos
    const pedidoData = {
      checkout_provider: "vega",
      transaction_token: transactionToken,
      status: status,
      method: payload.method || null,
      total_price: totalPrice,
      customer_name: customer.name || null,
      customer_document: customer.document || null,
      customer_email: customer.email || null,
      customer_phone: customer.phone || null,
      address_street: address.street || null,
      address_number: address.number || null,
      address_district: address.district || null,
      address_zip_code: address.zip_code || null,
      address_city: address.city || null,
      address_state: address.state || null,
      address_country: address.country || null,
      address_complement: address.complement || null,
      products: normalizedProducts,
      raw_payload: payload,
      loja_id: lojaId,
    };

    const { data: existingPedido } = await supabase
      .from("pedidos")
      .select("id, envio_id")
      .eq("checkout_provider", "vega")
      .eq("transaction_token", transactionToken)
      .eq("loja_id", lojaId)
      .maybeSingle();

    let pedidoId: string;

    if (existingPedido) {
      await supabase
        .from("pedidos")
        .update({ ...pedidoData, updated_at: new Date().toISOString() })
        .eq("id", existingPedido.id);
      pedidoId = existingPedido.id;
    } else {
      const { data: newPedido } = await supabase
        .from("pedidos")
        .insert(pedidoData)
        .select("id")
        .single();
      pedidoId = newPedido?.id;
    }

    // 4. If approved and no envio linked yet, create envio (with payment method filter)
    if (status === "approved" && !existingPedido?.envio_id && pedidoId) {
      // Check filtro_metodo from checkout_integrations
      const { data: integrationConfig } = await supabase
        .from("checkout_integrations")
        .select("filtro_metodo")
        .eq("loja_id", lojaId)
        .eq("checkout_id", "vega")
        .maybeSingle();

      const filtroMetodo = integrationConfig?.filtro_metodo || "todos";
      const methodValue = (payload.method || "").toLowerCase();
      const isPix = methodValue.includes("pix");
      const shouldCreateEnvio = filtroMetodo === "todos" || (filtroMetodo === "cartao" && !isPix) || (filtroMetodo === "pix" && isPix);

      if (!shouldCreateEnvio) {
        // Skip envio creation due to payment method filter
        await supabase.from("webhook_logs").update({ processed: true }).eq("checkout_provider", "vega").eq("loja_id", lojaId).order("created_at", { ascending: false }).limit(1);
        return new Response(JSON.stringify({ success: true, event_type: eventType, status, envio_skipped: true, reason: `filtro_metodo=${filtroMetodo}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const produtoJson = JSON.stringify(
        normalizedProducts.map((p: any) => ({ nome: p.title || p.name, quantidade: p.quantity || 1 }))
      );
      const totalQuantidade = normalizedProducts.reduce((sum: number, p: any) => sum + (p.quantity || 1), 0);

      // Buscar empresa da loja
      const { data: empresaData } = await supabase
        .from("empresas")
        .select("id")
        .eq("loja_id", lojaId)
        .maybeSingle();

      const envioData = {
        cliente_nome: customer.name || "Cliente Vega",
        cliente_email: customer.email || "sem-email@vega.com",
        cliente_cpf: customer.document || null,
        cliente_telefone: customer.phone || null,
        cliente_endereco: address.street || null,
        cliente_numero: address.number || null,
        cliente_bairro: address.district || null,
        cliente_cep: address.zip_code || null,
        cliente_cidade: address.city || null,
        cliente_estado: address.state || null,
        cliente_complemento: address.complement || null,
        produto: produtoJson || "Produto Vega",
        quantidade: totalQuantidade || 1,
        valor: totalPrice / 100,
        status: "pendente",
        loja_id: lojaId,
        empresa_id: empresaData?.id || null,
      };

      const { data: newEnvio } = await supabase
        .from("envios")
        .insert(envioData)
        .select("id")
        .single();

      if (newEnvio) {
        await supabase
          .from("pedidos")
          .update({ envio_id: newEnvio.id })
          .eq("id", pedidoId);
      }
    }

    // 5. Mark webhook as processed
    await supabase
      .from("webhook_logs")
      .update({ processed: true })
      .eq("checkout_provider", "vega")
      .eq("loja_id", lojaId)
      .order("created_at", { ascending: false })
      .limit(1);

    return new Response(
      JSON.stringify({ success: true, event_type: eventType, status }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
