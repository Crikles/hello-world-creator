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

  // GET for connectivity test
  if (req.method === "GET") {
    return new Response(JSON.stringify({ ok: true, provider: "nuvorafy" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

    // Check if integration is active
    const { data: integrationStatus } = await supabase
      .from("checkout_integrations")
      .select("ativo")
      .eq("loja_id", lojaId)
      .eq("checkout_id", "nuvorafy")
      .maybeSingle();

    if (integrationStatus?.ativo === false) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "integration_disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const event = payload.event || "";
    const order = payload.order || {};
    const transactionToken = String(order.id || `nuvorafy_${Date.now()}`);

    // Map event
    const eventType = event === "order.paid" ? "sale" : event;

    // 1. Log the webhook
    await supabase.from("webhook_logs").insert({
      checkout_provider: "nuvorafy",
      event_type: eventType,
      status: order.status || "paid",
      payload,
      processed: false,
      loja_id: lojaId,
    });

    // 2. Normalize data from Nuvorafy payload
    const items = order.items || [];
    const totalPrice = Math.round(parseFloat(String(order.amount || "0")) * 100);

    const normalizedProducts = items.map((item: any) => ({
      code: "",
      title: item.name || "",
      quantity: parseInt(String(item.quantity || "1"), 10),
      amount: 0,
    }));

    // Normalize payment method
    const rawMethod = (order.payment_method || "").toLowerCase();
    let method = rawMethod;
    if (rawMethod.includes("credit") || rawMethod.includes("cartao") || rawMethod.includes("card")) {
      method = "credit_card";
    } else if (rawMethod.includes("pix")) {
      method = "pix";
    } else if (rawMethod.includes("boleto")) {
      method = "boleto";
    }

    // 3. Upsert into pedidos
    const pedidoData = {
      checkout_provider: "nuvorafy",
      transaction_token: transactionToken,
      status: order.status || "paid",
      method,
      total_price: totalPrice,
      customer_name: order.customer_name || null,
      customer_document: order.customer_cpf || null,
      customer_email: order.customer_email || null,
      customer_phone: order.customer_phone || null,
      address_street: order.shipping_address || null,
      address_number: null,
      address_district: null,
      address_zip_code: order.shipping_zip || null,
      address_city: order.shipping_city || null,
      address_state: order.shipping_state || null,
      address_country: null,
      address_complement: null,
      products: normalizedProducts,
      raw_payload: payload,
      loja_id: lojaId,
    };

    const { data: existingPedido } = await supabase
      .from("pedidos")
      .select("id, envio_id")
      .eq("checkout_provider", "nuvorafy")
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

    // 4. If order.paid and no envio linked yet, create envio
    if (event === "order.paid" && !existingPedido?.envio_id && pedidoId) {
      // Check payment method filter
      const { data: integrationConfig } = await supabase
        .from("checkout_integrations")
        .select("filtro_metodo")
        .eq("loja_id", lojaId)
        .eq("checkout_id", "nuvorafy")
        .maybeSingle();

      const filtroMetodo = integrationConfig?.filtro_metodo || "todos";
      const isPix = method.includes("pix");
      const shouldCreateEnvio =
        filtroMetodo === "todos" ||
        (filtroMetodo === "cartao" && !isPix) ||
        (filtroMetodo === "pix" && isPix);

      if (!shouldCreateEnvio) {
        await supabase.from("webhook_logs").update({ processed: true })
          .eq("checkout_provider", "nuvorafy").eq("loja_id", lojaId)
          .order("created_at", { ascending: false }).limit(1);
        return new Response(
          JSON.stringify({ success: true, event_type: eventType, envio_skipped: true, reason: `filtro_metodo=${filtroMetodo}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const produtoJson = JSON.stringify(
        normalizedProducts.map((p: any) => ({ nome: p.title, quantidade: p.quantity || 1 }))
      );
      const totalQuantidade = normalizedProducts.reduce((sum: number, p: any) => sum + (p.quantity || 1), 0);

      // Get empresa
      const { data: empresaData } = await supabase
        .from("empresas")
        .select("id")
        .eq("loja_id", lojaId)
        .maybeSingle();

      // Parse CEP (remove hyphen)
      const cepClean = (order.shipping_zip || "").replace(/\D/g, "");

      const envioData = {
        cliente_nome: order.customer_name || "Cliente Nuvorafy",
        cliente_email: order.customer_email || "sem-email@nuvorafy.com",
        cliente_cpf: order.customer_cpf || null,
        cliente_telefone: order.customer_phone || null,
        cliente_endereco: order.shipping_address || null,
        cliente_numero: null,
        cliente_bairro: null,
        cliente_cep: cepClean || null,
        cliente_cidade: order.shipping_city || null,
        cliente_estado: order.shipping_state || null,
        cliente_complemento: null,
        produto: produtoJson || "Produto Nuvorafy",
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

        // Fire-and-forget WhatsApp for new order
        supabase.functions.invoke("auto-whatsapp-new-order", {
          body: { envio_id: newEnvio.id, loja_id: lojaId }
        }).catch((err) => console.error("[auto-whatsapp] invoke error:", err));
      }
    }

    // 5. Mark webhook as processed
    await supabase
      .from("webhook_logs")
      .update({ processed: true })
      .eq("checkout_provider", "nuvorafy")
      .eq("loja_id", lojaId)
      .order("created_at", { ascending: false })
      .limit(1);

    return new Response(
      JSON.stringify({ success: true, event_type: eventType }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook Nuvorafy error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
