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
    // Nuvorafy sends data in payload.order (snake_case), fallback to payload.data for compatibility
    const order = payload.order || payload.data || {};
    // cart.abandoned uses "id" and "cart_number"; order.paid/pending use "order_id" and "order_number"
    const isCartAbandoned = event === "cart.abandoned";
    const transactionToken = String(
      isCartAbandoned
        ? (order.id || order.order_id || `nuvorafy_${Date.now()}`)
        : (order.order_id || order.id || order.orderId || `nuvorafy_${Date.now()}`)
    );
    const orderNumber = isCartAbandoned
      ? (order.cart_number || order.order_number || "")
      : (order.order_number || order.orderNumber || order.cart_number || "");

    // Map event
    const orderStatus = (order.status || "").toLowerCase();
    const eventType = event === "order.paid" ? "sale" : event;

    // Normalize fields with snake_case + camelCase fallbacks
    const customerName = order.customer_name || order.customerName || null;
    const customerEmail = order.customer_email || order.customerEmail || null;
    const customerDocument = order.customer_cpf || order.customerCpf || order.customer_document || order.customerDocument || null;
    const customerPhone = order.customer_phone || order.customerPhone || null;
    const shippingAddress = order.shipping_address || order.shippingAddress || null;
    const shippingZip = order.shipping_zip || order.shippingZip || null;
    const shippingCity = order.shipping_city || order.shippingCity || null;
    const shippingState = order.shipping_state || order.shippingState || null;
    const rawPaymentMethod = (order.payment_method || order.paymentMethod || "").toLowerCase();
    const rawAmount = parseFloat(String(order.amount || order.total_amount || "0"));
    const checkoutUrl = order.checkout_link || order.checkout_url || order.checkoutUrl || order.payment_url || "";
    const pixCode = order.pix_code || order.pixCode || "";

    // 1. Log the webhook
    await supabase.from("webhook_logs").insert({
      checkout_provider: "nuvorafy",
      event_type: eventType,
      status: order.status || event,
      payload,
      processed: false,
      loja_id: lojaId,
    });

    // 2. Normalize products (supports both items and cart_items)
    const items = order.items || order.cart_items || [];
    // Amount is always in reais (e.g. 149.90), convert to centavos
    const totalPrice = Math.round(rawAmount * 100);

    const normalizedProducts = items.length > 0
      ? items.map((item: any) => ({
          code: "",
          title: item.name || item.title || "",
          quantity: parseInt(String(item.quantity || "1"), 10),
          amount: Math.round(parseFloat(String(item.price || "0")) * 100),
        }))
      : [{ code: "", title: orderNumber ? `Pedido ${orderNumber}` : "Produto Nuvorafy", quantity: 1, amount: 0 }];

    // Normalize payment method
    let method = rawPaymentMethod;
    if (rawPaymentMethod.includes("credit") || rawPaymentMethod.includes("cartao") || rawPaymentMethod.includes("card")) {
      method = "credit_card";
    } else if (rawPaymentMethod.includes("pix")) {
      method = "pix";
    } else if (rawPaymentMethod.includes("boleto")) {
      method = "boleto";
    }

    // 3. Upsert into pedidos (skip for cart.abandoned)
    let pedidoId: string | undefined;
    let existingPedido: any = null;

    if (event !== "cart.abandoned") {
      const pedidoData = {
        checkout_provider: "nuvorafy",
        transaction_token: transactionToken,
        status: order.status || "paid",
        method,
        total_price: totalPrice,
        customer_name: customerName,
        customer_document: customerDocument,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        address_street: shippingAddress,
        address_number: null,
        address_district: null,
        address_zip_code: shippingZip,
        address_city: shippingCity,
        address_state: shippingState,
        address_country: null,
        address_complement: null,
        products: normalizedProducts,
        raw_payload: payload,
        loja_id: lojaId,
      };

      const { data: existing } = await supabase
        .from("pedidos")
        .select("id, envio_id")
        .eq("checkout_provider", "nuvorafy")
        .eq("transaction_token", transactionToken)
        .eq("loja_id", lojaId)
        .maybeSingle();

      existingPedido = existing;

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
    }

    // 4. Recovery: order.pending (PIX) or cart.abandoned
    const isPixPending = event === "order.pending" || (orderStatus === "pending" && method === "pix") || (orderStatus === "processing" && method.includes("pix"));

    if (isPixPending || isCartAbandoned) {
      const recoveryTipo = isCartAbandoned ? "carrinho" : "pix_pendente";
      try {
        const { data: recoveryConfig } = await supabase
          .from("recovery_config")
          .select("ativo")
          .eq("loja_id", lojaId)
          .eq("tipo", recoveryTipo)
          .maybeSingle();

        if (recoveryConfig?.ativo) {
          if (customerEmail) {
            const { data: existingLead } = await supabase
              .from("recovery_leads")
              .select("id")
              .eq("loja_id", lojaId)
              .eq("tipo", recoveryTipo)
              .eq("raw_payload->>transaction_token", transactionToken)
              .maybeSingle();

            if (!existingLead) {
              const recoveryProducts = normalizedProducts.map((p: any) => ({
                name: p.title,
                value: (p.amount || 0) / 100,
                qty: p.quantity || 1,
              }));

              // Generate QR Code URL from pix_code if available
              const pixQrcodeUrl = pixCode
                ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pixCode)}`
                : "";

              const { data: insertedLead } = await supabase
                .from("recovery_leads")
                .insert({
                  loja_id: lojaId,
                  customer_name: customerName || "",
                  customer_email: customerEmail,
                  customer_phone: customerPhone || "",
                  products: recoveryProducts,
                  total_value: totalPrice / 100,
                  checkout_url: checkoutUrl,
                  pix_code: pixCode,
                  pix_qrcode_url: pixQrcodeUrl,
                  raw_payload: { ...payload, transaction_token: transactionToken },
                  status: "pendente",
                  tipo: recoveryTipo,
                })
                .select("id")
                .single();

              if (insertedLead) {
                supabase.functions.invoke("send-recovery-email", {
                  body: { loja_id: lojaId, customer_email: customerEmail, tipo: recoveryTipo },
                }).catch((e) => console.error("[recovery-email] error:", e));

                supabase.functions.invoke("send-recovery-sms", {
                  body: { lead_id: insertedLead.id, loja_id: lojaId, tipo: recoveryTipo },
                }).catch((e) => console.error("[recovery-sms] error:", e));
              }
            }
          }
        }
      } catch (recoveryErr) {
        console.error("[nuvorafy-recovery] error:", recoveryErr);
      }
    }

    // 5. If order.paid and no envio linked yet, create envio
    if (event === "order.paid" && !existingPedido?.envio_id && pedidoId) {
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

      const { data: empresaData } = await supabase
        .from("empresas")
        .select("id")
        .eq("loja_id", lojaId)
        .maybeSingle();

      const cepClean = (shippingZip || "").replace(/\D/g, "");

      const envioData = {
        cliente_nome: customerName || "Cliente Nuvorafy",
        cliente_email: customerEmail || "sem-email@nuvorafy.com",
        cliente_cpf: customerDocument,
        cliente_telefone: customerPhone,
        cliente_endereco: shippingAddress,
        cliente_numero: null,
        cliente_bairro: null,
        cliente_cep: cepClean || null,
        cliente_cidade: shippingCity,
        cliente_estado: shippingState,
        cliente_complemento: null,
        produto: produtoJson || "Produto Nuvorafy",
        quantidade: totalQuantidade || 1,
        valor: totalPrice / 100,
        status: "pendente",
        loja_id: lojaId,
        empresa_id: empresaData?.id || null,
      };

      // ATOMIC DEDUPE via RPC: serializa por (loja+email+valor) usando advisory lock
      const { data: dedupeResult, error: dedupeError } = await supabase
        .rpc("try_create_envio_dedupe", {
          _loja_id: lojaId,
          _cliente_email: envioData.cliente_email,
          _valor: envioData.valor,
          _envio_data: envioData,
        })
        .maybeSingle();

      if (dedupeError || !dedupeResult) {
        console.error("[webhook-nuvorafy] dedupe RPC error:", dedupeError);
        return new Response(JSON.stringify({ error: "Failed to create envio" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const newEnvio = { id: (dedupeResult as any).envio_id };
      const wasDuplicate = (dedupeResult as any).was_duplicate === true;

      if (wasDuplicate) {
        console.log("[webhook-nuvorafy] Duplicate envio blocked atomically:", newEnvio.id);
        await supabase.from("pedidos").update({ envio_id: newEnvio.id }).eq("id", pedidoId).is("envio_id", null);
        return new Response(JSON.stringify({ success: true, dedupe: true, envio_id: newEnvio.id }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      {
        const { data: updateResult } = await supabase
          .from("pedidos")
          .update({ envio_id: newEnvio.id })
          .eq("id", pedidoId)
          .is("envio_id", null)
          .select("id")
          .maybeSingle();

        if (!updateResult) {
          console.log("[webhook-nuvorafy] Pedido already linked, skipping invokes:", newEnvio.id);
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

    // 6. Mark webhook as processed
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
