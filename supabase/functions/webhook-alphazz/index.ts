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
    return new Response(JSON.stringify({ ok: true, provider: "alphazz" }), {
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

    const { data: integrationStatus } = await supabase
      .from("checkout_integrations")
      .select("ativo")
      .eq("loja_id", lojaId)
      .eq("checkout_id", "alphazz")
      .maybeSingle();

    if (integrationStatus?.ativo === false) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "integration_disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const event: string = payload.event || "";
    const data = payload.data || {};
    const customer = data.customer || {};
    const address = data.address || {};
    const products = Array.isArray(data.products) ? data.products : [];

    const transactionToken = String(data.hash || data.id || `alphazz_${Date.now()}`);
    const statusRaw = (data.status || "").toString().toUpperCase();
    const isPaidEvent = event === "customer_invoice.paid" || statusRaw === "PAID";
    const isPendingEvent = event === "customer_invoice.created" || statusRaw === "PENDING" || statusRaw === "OPEN";

    // Map event type
    const eventType = isPaidEvent ? "sale" : event;

    // Normalize fields
    const customerName = customer.name || data.customer_name || null;
    const customerEmail = customer.email || null;
    const customerDocument = customer.cpf_cnpj || data.customer_cpf_cnpj || null;
    const customerPhone = customer.phone || null;

    const rawPaymentMethod = (data.method_payment || "").toString().toLowerCase();
    let method = rawPaymentMethod;
    if (rawPaymentMethod.includes("credit") || rawPaymentMethod.includes("card") || rawPaymentMethod.includes("cartao")) {
      method = "credit_card";
    } else if (rawPaymentMethod.includes("pix")) {
      method = "pix";
    } else if (rawPaymentMethod.includes("boleto")) {
      method = "boleto";
    }

    const rawAmount = parseFloat(String(data.charged_amount ?? data.total_amount ?? data.paid_amount ?? "0"));
    const totalPrice = Math.round(rawAmount * 100);

    const checkoutUrl = data.checkout_url || "";

    // Log webhook
    await supabase.from("webhook_logs").insert({
      checkout_provider: "alphazz",
      event_type: eventType,
      status: data.status || event,
      payload,
      processed: false,
      loja_id: lojaId,
    });

    // Normalize products
    const normalizedProducts = products.length > 0
      ? products.map((p: any) => ({
          code: p.product_id ? String(p.product_id) : "",
          title: p.name || "",
          quantity: parseInt(String(p.quantity || "1"), 10),
          amount: Math.round(parseFloat(String(p.price || "0")) * 100),
        }))
      : [{ code: "", title: data.description || "Produto Alphazz", quantity: 1, amount: totalPrice }];

    // Address (Alphazz "address" is the street string)
    const shippingZip = (address.zip_code || "").toString().replace(/\D/g, "") || null;
    const shippingStreet = address.address || null;
    const shippingNumber = address.number || null;
    const shippingDistrict = address.district || null;
    const shippingCity = address.city_name || null;
    const shippingState = address.state_uf || null;
    const shippingComplement = address.complement || null;

    // Upsert pedido (skip on cancel)
    let pedidoId: string | undefined;
    let existingPedido: any = null;

    if (event !== "customer_invoice.cancelled") {
      const pedidoData = {
        checkout_provider: "alphazz",
        transaction_token: transactionToken,
        status: isPaidEvent ? "paid" : (data.status || "pending"),
        method,
        total_price: totalPrice,
        customer_name: customerName,
        customer_document: customerDocument,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        address_street: shippingStreet,
        address_number: shippingNumber,
        address_district: shippingDistrict,
        address_zip_code: shippingZip,
        address_city: shippingCity,
        address_state: shippingState,
        address_country: address.country_code || null,
        address_complement: shippingComplement,
        products: normalizedProducts,
        raw_payload: payload,
        loja_id: lojaId,
      };

      const { data: existing } = await supabase
        .from("pedidos")
        .select("id, envio_id")
        .eq("checkout_provider", "alphazz")
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

    // Recovery: PIX pendente
    const isPixPending = isPendingEvent && method === "pix";
    if (isPixPending) {
      try {
        const { data: recoveryConfig } = await supabase
          .from("recovery_config")
          .select("ativo")
          .eq("loja_id", lojaId)
          .eq("tipo", "pix_pendente")
          .maybeSingle();

        if (recoveryConfig?.ativo && customerEmail) {
          const { data: existingLead } = await supabase
            .from("recovery_leads")
            .select("id")
            .eq("loja_id", lojaId)
            .eq("tipo", "pix_pendente")
            .eq("raw_payload->>transaction_token", transactionToken)
            .maybeSingle();

          if (!existingLead) {
            const recoveryProducts = normalizedProducts.map((p: any) => ({
              name: p.title,
              value: (p.amount || 0) / 100,
              qty: p.quantity || 1,
            }));

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
                raw_payload: { ...payload, transaction_token: transactionToken },
                status: "pendente",
                tipo: "pix_pendente",
              })
              .select("id")
              .single();

            if (insertedLead) {
              supabase.functions.invoke("send-recovery-email", {
                body: { loja_id: lojaId, customer_email: customerEmail, tipo: "pix_pendente" },
              }).catch((e) => console.error("[recovery-email] error:", e));

              supabase.functions.invoke("send-recovery-sms", {
                body: { lead_id: insertedLead.id, loja_id: lojaId, tipo: "pix_pendente" },
              }).catch((e) => console.error("[recovery-sms] error:", e));
            }
          }
        }
      } catch (recoveryErr) {
        console.error("[alphazz-recovery] error:", recoveryErr);
      }
    }

    // Create envio on paid
    if (isPaidEvent && !existingPedido?.envio_id && pedidoId) {
      const { data: integrationConfig } = await supabase
        .from("checkout_integrations")
        .select("filtro_metodo")
        .eq("loja_id", lojaId)
        .eq("checkout_id", "alphazz")
        .maybeSingle();

      const filtroMetodo = integrationConfig?.filtro_metodo || "todos";
      const isPix = method.includes("pix");
      const shouldCreateEnvio =
        filtroMetodo === "todos" ||
        (filtroMetodo === "cartao" && !isPix) ||
        (filtroMetodo === "pix" && isPix);

      if (!shouldCreateEnvio) {
        await supabase.from("webhook_logs").update({ processed: true })
          .eq("checkout_provider", "alphazz").eq("loja_id", lojaId)
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

      const envioData = {
        cliente_nome: customerName || "Cliente Alphazz",
        cliente_email: customerEmail || "sem-email@alphazz.com",
        cliente_cpf: customerDocument,
        cliente_telefone: customerPhone,
        cliente_endereco: shippingStreet,
        cliente_numero: shippingNumber,
        cliente_bairro: shippingDistrict,
        cliente_cep: shippingZip,
        cliente_cidade: shippingCity,
        cliente_estado: shippingState,
        cliente_complemento: shippingComplement,
        produto: produtoJson || "Produto Alphazz",
        quantidade: totalQuantidade || 1,
        valor: totalPrice / 100,
        status: "pendente",
        loja_id: lojaId,
        empresa_id: empresaData?.id || null,
      };

      const { data: dedupeResult, error: dedupeError } = await supabase
        .rpc("try_create_envio_dedupe", {
          _loja_id: lojaId,
          _cliente_email: envioData.cliente_email,
          _valor: envioData.valor,
          _envio_data: envioData,
        })
        .maybeSingle();

      if (dedupeError || !dedupeResult) {
        console.error("[webhook-alphazz] dedupe RPC error:", dedupeError);
        return new Response(JSON.stringify({ error: "Failed to create envio" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const newEnvio = { id: (dedupeResult as any).envio_id };
      const wasDuplicate = (dedupeResult as any).was_duplicate === true;

      if (wasDuplicate) {
        console.log("[webhook-alphazz] Duplicate envio blocked atomically:", newEnvio.id);
        await supabase.from("pedidos").update({ envio_id: newEnvio.id }).eq("id", pedidoId).is("envio_id", null);
        supabase.functions.invoke("send-payment-confirmation", {
          body: { pedido_id: pedidoId, loja_id: lojaId }
        }).catch((err: any) => console.error("[payment-confirmation] invoke error (dedupe path):", err));
        return new Response(JSON.stringify({ success: true, dedupe: true, envio_id: newEnvio.id }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: updateResult } = await supabase
        .from("pedidos")
        .update({ envio_id: newEnvio.id })
        .eq("id", pedidoId)
        .is("envio_id", null)
        .select("id")
        .maybeSingle();

      if (!updateResult) {
        console.log("[webhook-alphazz] Pedido already linked, skipping invokes:", newEnvio.id);
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

    await supabase
      .from("webhook_logs")
      .update({ processed: true })
      .eq("checkout_provider", "alphazz")
      .eq("loja_id", lojaId)
      .order("created_at", { ascending: false })
      .limit(1);

    return new Response(
      JSON.stringify({ success: true, message: "Webhook recebido", event_type: eventType }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook Alphazz error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
