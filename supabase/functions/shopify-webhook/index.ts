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

    // Check if integration is active
    const { data: integrationStatus } = await supabase
      .from("checkout_integrations")
      .select("ativo")
      .eq("loja_id", lojaId)
      .eq("checkout_id", "shopify")
      .maybeSingle();

    if (integrationStatus?.ativo === false) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "integration_disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === Shopify native payload mapping ===
    const customer = payload.customer || {};
    const shippingAddress = payload.shipping_address || {};
    const lineItems = payload.line_items || [];

    const status = payload.financial_status || "";
    const transactionToken = String(payload.id || `shopify_${Date.now()}`);
    const eventType = status === "paid" ? "sale" : status;

    const customerName = (`${customer.first_name || ""} ${customer.last_name || ""}`).trim() || null;
    const customerEmail = payload.email || customer.email || null;
    const customerPhone = shippingAddress.phone || customer.default_address?.phone || null;
    const customerDocument = shippingAddress.company || null; // CPF in company field (BR)

    const totalPrice = Math.round(parseFloat(payload.current_total_price || "0") * 100);

    const normalizedProducts = lineItems.map((item: any) => ({
      code: String(item.product_id || item.sku || ""),
      title: item.title || "",
      quantity: parseInt(String(item.quantity || "1"), 10),
      amount: Math.round(parseFloat(item.price || "0") * 100),
    }));

    // 1. Log the webhook
    await supabase.from("webhook_logs").insert({
      checkout_provider: "shopify",
      event_type: eventType,
      status,
      payload,
      processed: false,
      loja_id: lojaId,
    });

    // 2. Upsert into pedidos
    const pedidoData = {
      checkout_provider: "shopify",
      transaction_token: transactionToken,
      status,
      method: payload.payment_gateway_names?.[0] || null,
      total_price: totalPrice,
      customer_name: customerName,
      customer_document: customerDocument,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      address_street: shippingAddress.address1 || null,
      address_number: null,
      address_district: null,
      address_zip_code: shippingAddress.zip || null,
      address_city: shippingAddress.city || null,
      address_state: shippingAddress.province_code || null,
      address_country: shippingAddress.country || null,
      address_complement: shippingAddress.address2 || null,
      products: normalizedProducts,
      raw_payload: payload,
      loja_id: lojaId,
    };

    const { data: existingPedido } = await supabase
      .from("pedidos")
      .select("id, envio_id")
      .eq("checkout_provider", "shopify")
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

    // === Recovery: PIX Pendente ===
    const methodLower = (payload.method || payload.payment_gateway_names?.[0] || "").toLowerCase();
    if (status === "pending" && methodLower.includes("pix") && customerEmail) {
      const recoveryTipo = "pix_pendente";
      try {
        const { data: recoveryConfig } = await supabase
          .from("recovery_config")
          .select("ativo")
          .eq("loja_id", lojaId)
          .eq("tipo", recoveryTipo)
          .maybeSingle();

        if (recoveryConfig?.ativo) {
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const { data: existingLead } = await supabase
            .from("recovery_leads")
            .select("id")
            .eq("loja_id", lojaId)
            .eq("customer_email", customerEmail)
            .eq("tipo", recoveryTipo)
            .gte("created_at", oneDayAgo)
            .limit(1);

          if (!existingLead || existingLead.length === 0) {
            const recoveryProducts = normalizedProducts.map((p: any) => ({
              name: p.title,
              value: p.amount / 100,
              qty: p.quantity,
            }));

            await supabase.from("recovery_leads").insert({
              loja_id: lojaId,
              customer_name: customerName || "",
              customer_email: customerEmail,
              customer_phone: customerPhone || "",
              products: recoveryProducts,
              total_value: totalPrice / 100,
              checkout_url: payload.order_url || "",
              raw_payload: payload,
              status: "pendente",
              tipo: recoveryTipo,
            });

            supabase.functions.invoke("send-recovery-email", {
              body: { loja_id: lojaId, customer_email: customerEmail, tipo: recoveryTipo },
            }).catch((e) => console.error("[recovery-email] error:", e));

            supabase.functions.invoke("send-recovery-sms", {
              body: { loja_id: lojaId, customer_email: customerEmail, tipo: recoveryTipo },
            }).catch((e) => console.error("[recovery-sms] error:", e));
          }
        }
      } catch (e) {
        console.error("[shopify-recovery] error:", e);
      }
    }

    // 3. If paid and no envio linked yet, create envio (with payment method filter)
    if (status === "paid" && !existingPedido?.envio_id && pedidoId) {
      const { data: integrationConfig } = await supabase
        .from("checkout_integrations")
        .select("filtro_metodo")
        .eq("loja_id", lojaId)
        .eq("checkout_id", "shopify")
        .maybeSingle();

      const filtroMetodo = integrationConfig?.filtro_metodo || "todos";
      const methodValue = (payload.payment_gateway_names?.[0] || "").toLowerCase();
      const isPix = methodValue.includes("pix");
      const shouldCreateEnvio = filtroMetodo === "todos" || (filtroMetodo === "cartao" && !isPix) || (filtroMetodo === "pix" && isPix);

      if (!shouldCreateEnvio) {
        await supabase.from("webhook_logs").update({ processed: true }).eq("checkout_provider", "shopify").eq("loja_id", lojaId).order("created_at", { ascending: false }).limit(1);
        return new Response(JSON.stringify({ success: true, event_type: eventType, status, envio_skipped: true, reason: `filtro_metodo=${filtroMetodo}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const firstProduct = normalizedProducts[0] || {};

      const { data: empresaData } = await supabase
        .from("empresas")
        .select("id")
        .eq("loja_id", lojaId)
        .maybeSingle();

      const envioData = {
        cliente_nome: customerName || "Cliente Shopify",
        cliente_email: customerEmail || "sem-email@shopify.com",
        cliente_cpf: customerDocument,
        cliente_telefone: customerPhone,
        cliente_endereco: shippingAddress.address1 || null,
        cliente_numero: null,
        cliente_bairro: null,
        cliente_cep: shippingAddress.zip || null,
        cliente_cidade: shippingAddress.city || null,
        cliente_estado: shippingAddress.province_code || null,
        cliente_complemento: shippingAddress.address2 || null,
        produto: normalizedProducts.length > 0
          ? JSON.stringify(normalizedProducts.map((p: any) => ({ nome: p.title, quantidade: p.quantity })))
          : "Produto Shopify",
        quantidade: normalizedProducts.reduce((sum: number, p: any) => sum + p.quantity, 0) || 1,
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
        // Race condition protection: only link envio if pedido still has no envio_id
        const { data: updateResult } = await supabase
          .from("pedidos")
          .update({ envio_id: newEnvio.id })
          .eq("id", pedidoId)
          .is("envio_id", null)
          .select("id")
          .maybeSingle();

        if (!updateResult) {
          console.log("[shopify-webhook] Race condition detected, deleting duplicate envio:", newEnvio.id);
          await supabase.from("envios").delete().eq("id", newEnvio.id);
        } else {
          supabase.functions.invoke("auto-whatsapp-new-order", {
            body: { envio_id: newEnvio.id, loja_id: lojaId }
          }).catch((err) => console.error("[auto-whatsapp] invoke error:", err));

          supabase.functions.invoke("advance-shipments", { body: { loja_id: lojaId } })
            .catch((err) => console.error("[advance-shipments] invoke error:", err));

          supabase.functions.invoke("send-payment-confirmation", {
            body: { pedido_id: pedidoId, loja_id: lojaId }
          }).catch((err) => console.error("[payment-confirmation] invoke error:", err));
        }
      }
    }

    // 4. Mark webhook as processed
    await supabase
      .from("webhook_logs")
      .update({ processed: true })
      .eq("checkout_provider", "shopify")
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
    console.error("Webhook Shopify error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
