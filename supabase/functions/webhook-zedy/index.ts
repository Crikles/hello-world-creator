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

    // Ignore test transactions
    if (payload.isTest === true) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "test transaction" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      .eq("checkout_id", "zedy")
      .maybeSingle();

    if (integrationStatus?.ativo === false) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "integration_disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const status = payload.status || "";
    const transactionToken = payload.orderId || `zedy_${Date.now()}`;

    // 1. Log the webhook
    await supabase.from("webhook_logs").insert({
      checkout_provider: "zedy",
      event_type: status === "paid" ? "sale" : status,
      status: status,
      payload: payload,
      processed: false,
      loja_id: lojaId,
    });

    // 1b. Recovery logic for waiting_payment
    if (status === "waiting_payment") {
      const customer = payload.customer || {};
      const email = customer.email || "";
      if (email) {
        const recoveryTipo = (payload.paymentMethod || "").toLowerCase().includes("pix") ? "pix_pendente" : "carrinho";

        const { data: recoveryConfig } = await supabase
          .from("recovery_config")
          .select("ativo")
          .eq("loja_id", lojaId)
          .eq("tipo", recoveryTipo)
          .maybeSingle();

        if (recoveryConfig?.ativo) {
          const orderId = payload.orderId || "";
          if (orderId) {
            const rawProducts = payload.products || [];
            const recoveryProducts = rawProducts.map((p: any) => ({
              name: p.name || "Produto",
              value: (p.priceInCents || 0) / 100,
              qty: p.quantity || 1,
            }));
            const totalValue = (payload.commission?.totalPriceInCents || 0) / 100;

            const pixCode = payload.pixQrCode || "";
            const pixQrcodeUrl = pixCode
              ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pixCode)}`
              : "";

            // Insert with race-safe dedupe via unique index on (loja_id, raw_payload->>'orderId')
            const { data: insertedLead, error: insertErr } = await supabase
              .from("recovery_leads")
              .insert({
                loja_id: lojaId,
                customer_name: customer.name || "",
                customer_email: email,
                customer_phone: customer.phone || "",
                products: recoveryProducts,
                total_value: totalValue,
                checkout_url: "",
                pix_code: pixCode,
                pix_qrcode_url: pixQrcodeUrl,
                raw_payload: payload,
                status: "pendente",
                tipo: recoveryTipo,
              })
              .select("id")
              .maybeSingle();

            if (insertErr) {
              if ((insertErr as any).code === "23505") {
                console.log("[webhook-zedy] Duplicate orderId blocked by unique index:", orderId);
              } else {
                console.error("[webhook-zedy] insert recovery_leads error:", insertErr);
              }
            } else if (insertedLead) {
              // Fire-and-forget: email + sms (only on first insert)
              supabase.functions.invoke("send-recovery-email", {
                body: { loja_id: lojaId, customer_email: email, tipo: recoveryTipo },
              }).catch((e) => console.error("[recovery-email]", e));

              supabase.functions.invoke("send-recovery-sms", {
                body: { loja_id: lojaId, customer_email: email, tipo: recoveryTipo },
              }).catch((e) => console.error("[recovery-sms]", e));
            }
          }
        }
      }
    }

    // 2. Normalize data
    const customer = payload.customer || {};
    const address = payload.address || {};
    const products = payload.products || [];
    const commission = payload.commission || {};

    const totalPrice = commission.totalPriceInCents
      ? Math.round(Number(commission.totalPriceInCents))
      : 0;

    const normalizedProducts = products.map((p: any) => ({
      code: String(p.id || ""),
      title: p.name || "",
      quantity: p.quantity || 1,
      amount: p.priceInCents || 0,
    }));

    // 3. Upsert into pedidos
    const pedidoData = {
      checkout_provider: "zedy",
      transaction_token: transactionToken,
      status: status,
      method: payload.paymentMethod || null,
      total_price: totalPrice,
      customer_name: customer.name || null,
      customer_document: customer.document || null,
      customer_email: customer.email || null,
      customer_phone: customer.phone || null,
      address_street: address.street || null,
      address_number: address.number || null,
      address_district: address.neighborhood || null,
      address_zip_code: address.zipcode || null,
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
      .eq("checkout_provider", "zedy")
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

    // 4. If paid and no envio linked yet, create envio (with payment method filter)
    if (status === "paid" && !existingPedido?.envio_id && pedidoId) {
      const { data: integrationConfig } = await supabase
        .from("checkout_integrations")
        .select("filtro_metodo")
        .eq("loja_id", lojaId)
        .eq("checkout_id", "zedy")
        .maybeSingle();

      const filtroMetodo = integrationConfig?.filtro_metodo || "todos";
      const methodValue = (payload.paymentMethod || "").toLowerCase();
      const isPix = methodValue.includes("pix");
      const shouldCreateEnvio = filtroMetodo === "todos" || (filtroMetodo === "cartao" && !isPix) || (filtroMetodo === "pix" && isPix);

      if (!shouldCreateEnvio) {
        await supabase.from("webhook_logs").update({ processed: true }).eq("checkout_provider", "zedy").eq("loja_id", lojaId).order("created_at", { ascending: false }).limit(1);
        return new Response(JSON.stringify({ success: true, event_type: status === "paid" ? "sale" : status, status, envio_skipped: true, reason: `filtro_metodo=${filtroMetodo}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const produtoJson = JSON.stringify(
        normalizedProducts.map((p: any) => ({ nome: p.title, quantidade: p.quantity || 1 }))
      );
      const totalQuantidade = normalizedProducts.reduce((sum: number, p: any) => sum + (p.quantity || 1), 0);

      // Buscar empresa da loja
      const { data: empresaData } = await supabase
        .from("empresas")
        .select("id")
        .eq("loja_id", lojaId)
        .maybeSingle();

      const envioData = {
        cliente_nome: customer.name || "Cliente Zedy",
        cliente_email: customer.email || "sem-email@zedy.com",
        cliente_cpf: customer.document || null,
        cliente_telefone: customer.phone || null,
        cliente_endereco: address.street || null,
        cliente_numero: address.number || null,
        cliente_bairro: address.neighborhood || null,
        cliente_cep: address.zipcode || null,
        cliente_cidade: address.city || null,
        cliente_estado: address.state || null,
        cliente_complemento: address.complement || null,
        produto: produtoJson || "Produto Zedy",
        quantidade: totalQuantidade || 1,
        valor: totalPrice / 100,
        status: "pendente",
        loja_id: lojaId,
        empresa_id: empresaData?.id || null,
      };

      // ATOMIC DEDUPE via RPC: serializa por (loja+email+valor) usando advisory lock,
      // impedindo que múltiplos webhooks paralelos do mesmo pedido criem envios duplicados.
      const { data: dedupeResult, error: dedupeError } = await supabase
        .rpc("try_create_envio_dedupe", {
          _loja_id: lojaId,
          _cliente_email: envioData.cliente_email,
          _valor: envioData.valor,
          _envio_data: envioData,
        })
        .maybeSingle();

      if (dedupeError || !dedupeResult) {
        console.error("[webhook-zedy] dedupe RPC error:", dedupeError);
        await supabase.from("webhook_logs").update({ processed: true }).eq("checkout_provider", "zedy").eq("loja_id", lojaId).order("created_at", { ascending: false }).limit(1);
        return new Response(JSON.stringify({ error: "Failed to create envio" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const newEnvio = { id: (dedupeResult as any).envio_id };
      const wasDuplicate = (dedupeResult as any).was_duplicate === true;

      if (wasDuplicate) {
        console.log("[webhook-zedy] Duplicate envio blocked atomically:", newEnvio.id);
        await supabase.from("pedidos").update({ envio_id: newEnvio.id }).eq("id", pedidoId).is("envio_id", null);
        // Garante envio da confirmação de pagamento mesmo no caminho duplicado (idempotente)
        supabase.functions.invoke("send-payment-confirmation", {
          body: { pedido_id: pedidoId, loja_id: lojaId }
        }).catch((err) => console.error("[payment-confirmation] invoke error (dedupe path):", err));
        await supabase.from("webhook_logs").update({ processed: true }).eq("checkout_provider", "zedy").eq("loja_id", lojaId).order("created_at", { ascending: false }).limit(1);
        return new Response(JSON.stringify({ success: true, dedupe: true, envio_id: newEnvio.id }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      {
        // Link envio to pedido (only if pedido still has no envio_id)
        const { data: updateResult } = await supabase
          .from("pedidos")
          .update({ envio_id: newEnvio.id })
          .eq("id", pedidoId)
          .is("envio_id", null)
          .select("id")
          .maybeSingle();

        if (!updateResult) {
          console.log("[webhook-zedy] Pedido already linked to another envio, skipping invokes:", newEnvio.id);
        } else {
          // Fire-and-forget WhatsApp for new order
          supabase.functions.invoke("auto-whatsapp-new-order", {
            body: { envio_id: newEnvio.id, loja_id: lojaId }
          }).catch((err) => console.error("[auto-whatsapp] invoke error:", err));

          // Fire-and-forget: trigger server-side advance immediately for this exact envio/store
          supabase.functions.invoke("advance-shipments", {
            body: { envio_id: newEnvio.id, loja_id: lojaId },
          })
            .catch((err) => console.error("[advance-shipments] invoke error:", err));

          // Fire-and-forget payment confirmation email/SMS
          supabase.functions.invoke("send-payment-confirmation", {
            body: { pedido_id: pedidoId, loja_id: lojaId }
          }).catch((err) => console.error("[payment-confirmation] invoke error:", err));
        }
      }
    }

    // 5. Mark webhook as processed
    await supabase
      .from("webhook_logs")
      .update({ processed: true })
      .eq("checkout_provider", "zedy")
      .eq("loja_id", lojaId)
      .order("created_at", { ascending: false })
      .limit(1);

    return new Response(
      JSON.stringify({ success: true, event_type: status === "paid" ? "sale" : status, status }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Webhook Zedy error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
