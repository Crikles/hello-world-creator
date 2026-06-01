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
      .eq("checkout_id", "luna")
      .maybeSingle();

    if (integrationStatus?.ativo === false) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "integration_disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const event = payload.event || "";
    const status = payload.status || "";
    const transactionToken = String(payload.id || `luna_${Date.now()}`);

    // Map event to event_type (Luna sends event names without "event_" prefix)
    const eventTypeMap: Record<string, string> = {
      "sale_approved": "sale",
      "sale_pending": "pending",
      "sale_waiting_payment": "waiting_payment",
      "sale_refused": "refused",
      "sale_chargeback": "chargeback",
      "sale_refunded": "refunded",
      "sale_cancelled": "cancelled",
      "sale_cart_abandoned": "abandoned_cart",
      "sale_cart_recovered": "cart_recovered",
    };
    const eventType = eventTypeMap[event] || event;

    // 1. Log the webhook
    await supabase.from("webhook_logs").insert({
      checkout_provider: "luna",
      event_type: eventType,
      status,
      payload,
      processed: false,
      loja_id: lojaId,
    });

    // 2. Normalize data
    const client = payload.client || {};
    const address = payload.address || {};
    const items = payload.items || [];

    const totalPrice = Math.round(parseFloat(String(payload.amount || "0")) * 100);

    const normalizedProducts = items.map((item: any) => ({
      code: String(item.id || ""),
      title: item.name || "",
      quantity: parseInt(String(item.quantity || "1"), 10),
      amount: Math.round(parseFloat(String(item.price || "0")) * 100),
    }));

    // 3. Upsert into pedidos
    const pedidoData = {
      checkout_provider: "luna",
      transaction_token: transactionToken,
      status,
      method: payload.method || null,
      total_price: totalPrice,
      customer_name: client.name || null,
      customer_document: client.doc || null,
      customer_email: client.email || null,
      customer_phone: client.phone || null,
      address_street: address.street || null,
      address_number: address.number || null,
      address_district: address.neighborhood || null,
      address_zip_code: address.zipcode || null,
      address_city: address.city || null,
      address_state: address.state || null,
      address_country: null,
      address_complement: address.complement || null,
      products: normalizedProducts,
      raw_payload: payload,
      loja_id: lojaId,
    };

    const { data: existingPedido } = await supabase
      .from("pedidos")
      .select("id, envio_id")
      .eq("checkout_provider", "luna")
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

    // 4. Recovery: pending PIX
    const methodLower = (payload.method || "").toLowerCase();
    const isPendingPix = event === "sale_waiting_payment" && methodLower === "pix";

    if (isPendingPix && client.email) {
      const recoveryTipo = "pix_pendente";
      try {
        const { data: recoveryConfig } = await supabase
          .from("recovery_config")
          .select("ativo")
          .eq("loja_id", lojaId)
          .eq("tipo", recoveryTipo)
          .eq("ativo", true)
          .maybeSingle();

        if (recoveryConfig) {
          // Deduplicação por transaction token (payload.id)
          const { data: existingLead } = await supabase
            .from("recovery_leads")
            .select("id")
            .eq("loja_id", lojaId)
            .filter("raw_payload->>id", "eq", String(payload.id || ""))
            .maybeSingle();

          if (!existingLead) {
            const recoveryProducts = items.map((item: any) => ({
              name: item.name || "",
              value: parseFloat(String(item.price || "0")),
              qty: parseInt(String(item.quantity || "1"), 10),
            }));

            const checkoutUrl = payload.checkout_url || "";
            const totalValue = parseFloat(String(payload.amount || "0"));
            const pixCode = payload.payment?.qrcode || "";

            const { data: newLead } = await supabase
              .from("recovery_leads")
              .insert({
                loja_id: lojaId,
                tipo: recoveryTipo,
                customer_name: client.name || "",
                customer_email: client.email,
                customer_phone: client.phone || "",
                checkout_url: checkoutUrl,
                total_value: totalValue,
                pix_code: pixCode,
                products: recoveryProducts,
                raw_payload: payload,
                status: "pendente",
              })
              .select("id")
              .single();

            if (newLead) {
              supabase.functions.invoke("send-recovery-email", {
                body: { lead_id: newLead.id, loja_id: lojaId, tipo: recoveryTipo },
              }).catch((err) => console.error("[recovery-email] error:", err));

              supabase.functions.invoke("send-recovery-sms", {
                body: { lead_id: newLead.id, loja_id: lojaId, tipo: recoveryTipo },
              }).catch((err) => console.error("[recovery-sms] error:", err));
            }
          }
        }
      } catch (recoveryErr) {
        console.error("[recovery] Luna error:", recoveryErr);
      }
    }

    // 5. If paid and no envio linked yet, create envio (with payment method filter)
    if (status === "paid" && !existingPedido?.envio_id && pedidoId) {
      const { data: integrationConfig } = await supabase
        .from("checkout_integrations")
        .select("filtro_metodo")
        .eq("loja_id", lojaId)
        .eq("checkout_id", "luna")
        .maybeSingle();

      const filtroMetodo = integrationConfig?.filtro_metodo || "todos";
      const methodValue = (payload.method || "").toLowerCase();
      const isPix = methodValue.includes("pix");
      const shouldCreateEnvio = filtroMetodo === "todos" || (filtroMetodo === "cartao" && !isPix) || (filtroMetodo === "pix" && isPix);

      if (!shouldCreateEnvio) {
        await supabase.from("webhook_logs").update({ processed: true }).eq("checkout_provider", "luna").eq("loja_id", lojaId).order("created_at", { ascending: false }).limit(1);
        return new Response(JSON.stringify({ success: true, event_type: eventType, status, envio_skipped: true, reason: `filtro_metodo=${filtroMetodo}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
        cliente_nome: client.name || "Cliente Luna",
        cliente_email: client.email || "sem-email@luna.com",
        cliente_cpf: client.doc || null,
        cliente_telefone: client.phone || null,
        cliente_endereco: address.street || null,
        cliente_numero: address.number || null,
        cliente_bairro: address.neighborhood || null,
        cliente_cep: address.zipcode || null,
        cliente_cidade: address.city || null,
        cliente_estado: address.state || null,
        cliente_complemento: address.complement || null,
        produto: produtoJson || "Produto Luna",
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
        console.error("[webhook-luna] dedupe RPC error:", dedupeError);
        return new Response(JSON.stringify({ error: "Failed to create envio" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const newEnvio = { id: (dedupeResult as any).envio_id };
      const wasDuplicate = (dedupeResult as any).was_duplicate === true;

      if (wasDuplicate) {
        console.log("[webhook-luna] Duplicate envio blocked atomically:", newEnvio.id);
        await supabase.from("pedidos").update({ envio_id: newEnvio.id }).eq("id", pedidoId).is("envio_id", null);
        supabase.functions.invoke("send-payment-confirmation", {
          body: { pedido_id: pedidoId, loja_id: lojaId }
        }).catch((err: any) => console.error("[payment-confirmation] invoke error (dedupe path):", err));
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
          console.log("[webhook-luna] Pedido already linked, skipping invokes:", newEnvio.id);
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
      .eq("checkout_provider", "luna")
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
    console.error("Webhook Luna error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
