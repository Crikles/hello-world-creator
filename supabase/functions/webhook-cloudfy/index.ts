import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function normalizeStatus(raw: string): string {
  const s = (raw || "").toUpperCase();
  if (["PAID", "APPROVED", "PIX_APPROVED", "BOLETO_APPROVED", "CREDIT_CARD_APPROVED"].includes(s)) return "paid";
  if (["PENDING", "WAITING_PAYMENT", "PIX_GENERATED", "BOLETO_GENERATED"].includes(s)) return "waiting_payment";
  if (["ABANDONED", "CHECKOUT_ABANDONED"].includes(s)) return "abandoned";
  if (["REFUNDED", "ORDER_REFUNDED"].includes(s)) return "refunded";
  if (["CHARGEBACK", "ORDER_CHARGED_BACK"].includes(s)) return "chargeback";
  if (["EXPIRED", "PIX_EXPIRED", "REFUSED", "CREDIT_CARD_REFUSED"].includes(s)) return "failed";
  return s.toLowerCase();
}

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

    const body = await req.json();
    // Cloudfy may send {type, payload} or the raw order object
    const eventType: string = body.type || body.event || "";
    const payload: any = body.payload || body.data || body;

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
      .eq("checkout_id", "cloudfy")
      .maybeSingle();

    if (integrationStatus?.ativo === false) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "integration_disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const status = normalizeStatus(eventType || payload.status || "");
    const transactionToken = String(payload._id || payload.id || payload.orderId || `cloudfy_${Date.now()}`);

    await supabase.from("webhook_logs").insert({
      checkout_provider: "cloudfy",
      event_type: eventType || status,
      status,
      payload: body,
      processed: false,
      loja_id: lojaId,
    });

    // Normalize fields
    const customerName = payload.payerName || payload.fullName || payload.customer?.name || "";
    const customerEmail = payload.payerEmail || payload.email || payload.customer?.email || "";
    const customerPhone = payload.phone || payload.customer?.phone || "";
    const customerDoc = payload.payerCpf || payload.cpf || payload.customer?.document || "";
    const shipping = payload.shipping || {};
    const items = payload.items || [];
    const totalValue = Number(payload.value || 0);
    const totalPriceCents = Math.round(totalValue * 100);
    const paymentMethod = payload.paymentMethod || "";

    const normalizedProducts = items.map((it: any) => ({
      code: String(it.product?._id || it.product?.id || ""),
      title: it.product?.name?.trim() || it.name || "Produto",
      quantity: it.quantity || 1,
      amount: Math.round(Number(it.product?.price || it.price || 0) * 100),
    }));

    // Recovery flow for waiting_payment (PIX/boleto pending) or abandoned
    if (status === "waiting_payment" || status === "abandoned") {
      if (customerEmail) {
        const isPix = (paymentMethod || "").toUpperCase().includes("PIX");
        const recoveryTipo = status === "abandoned" ? "carrinho" : (isPix ? "pix_pendente" : "carrinho");

        const { data: recoveryConfig } = await supabase
          .from("recovery_config")
          .select("ativo")
          .eq("loja_id", lojaId)
          .eq("tipo", recoveryTipo)
          .maybeSingle();

        if (recoveryConfig?.ativo) {
          const recoveryProducts = items.map((it: any) => ({
            name: it.product?.name?.trim() || "Produto",
            value: Number(it.product?.price || 0),
            qty: it.quantity || 1,
          }));

          const pixCode = payload.qrCode || "";
          const pixQrcodeUrl = payload.base64QrCode || (pixCode
            ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pixCode)}`
            : "");

          const { data: insertedLead, error: insertErr } = await supabase
            .from("recovery_leads")
            .insert({
              loja_id: lojaId,
              customer_name: customerName,
              customer_email: customerEmail,
              customer_phone: customerPhone,
              products: recoveryProducts,
              total_value: totalValue,
              checkout_url: payload.orderPendingUrl || "",
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
              console.log("[webhook-cloudfy] Duplicate orderId blocked:", transactionToken);
            } else {
              console.error("[webhook-cloudfy] insert recovery_leads error:", insertErr);
            }
          } else if (insertedLead) {
            supabase.functions.invoke("send-recovery-email", {
              body: { loja_id: lojaId, customer_email: customerEmail, tipo: recoveryTipo },
            }).catch((e) => console.error("[recovery-email]", e));

            supabase.functions.invoke("send-recovery-sms", {
              body: { loja_id: lojaId, customer_email: customerEmail, tipo: recoveryTipo },
            }).catch((e) => console.error("[recovery-sms]", e));
          }
        }
      }
    }

    // Upsert pedido
    const pedidoData = {
      checkout_provider: "cloudfy",
      transaction_token: transactionToken,
      status,
      method: paymentMethod || null,
      total_price: totalPriceCents,
      customer_name: customerName || null,
      customer_document: customerDoc || null,
      customer_email: customerEmail || null,
      customer_phone: customerPhone || null,
      address_street: shipping.street || null,
      address_number: shipping.number ? String(shipping.number) : null,
      address_district: shipping.neighborhood || null,
      address_zip_code: shipping.cep || shipping.zipcode || null,
      address_city: shipping.city || null,
      address_state: shipping.state || null,
      address_country: shipping.country || "BR",
      address_complement: shipping.complement || null,
      products: normalizedProducts,
      raw_payload: payload,
      loja_id: lojaId,
    };

    const { data: existingPedido } = await supabase
      .from("pedidos")
      .select("id, envio_id")
      .eq("checkout_provider", "cloudfy")
      .eq("transaction_token", transactionToken)
      .eq("loja_id", lojaId)
      .maybeSingle();

    let pedidoId: string | undefined;

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

    // Create envio if paid
    if (status === "paid" && !existingPedido?.envio_id && pedidoId) {
      const { data: integrationConfig } = await supabase
        .from("checkout_integrations")
        .select("filtro_metodo")
        .eq("loja_id", lojaId)
        .eq("checkout_id", "cloudfy")
        .maybeSingle();

      const filtroMetodo = integrationConfig?.filtro_metodo || "todos";
      const methodValue = (paymentMethod || "").toLowerCase();
      const isPix = methodValue.includes("pix");
      const shouldCreateEnvio = filtroMetodo === "todos" || (filtroMetodo === "cartao" && !isPix) || (filtroMetodo === "pix" && isPix);

      if (shouldCreateEnvio) {
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
          cliente_nome: customerName || "Cliente Cloudfy",
          cliente_email: customerEmail || "sem-email@cloudfy.com",
          cliente_cpf: customerDoc || null,
          cliente_telefone: customerPhone || null,
          cliente_endereco: shipping.street || null,
          cliente_numero: shipping.number ? String(shipping.number) : null,
          cliente_bairro: shipping.neighborhood || null,
          cliente_cep: shipping.cep || shipping.zipcode || null,
          cliente_cidade: shipping.city || null,
          cliente_estado: shipping.state || null,
          cliente_complemento: shipping.complement || null,
          produto: produtoJson || "Produto Cloudfy",
          quantidade: totalQuantidade || 1,
          valor: totalValue,
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

        if (!dedupeError && dedupeResult) {
          const newEnvioId = (dedupeResult as any).envio_id;
          const wasDuplicate = (dedupeResult as any).was_duplicate === true;

          if (wasDuplicate) {
            await supabase.from("pedidos").update({ envio_id: newEnvioId }).eq("id", pedidoId).is("envio_id", null);
            supabase.functions.invoke("send-payment-confirmation", {
              body: { pedido_id: pedidoId, loja_id: lojaId }
            }).catch((err) => console.error("[payment-confirmation]", err));
          } else {
            const { data: updateResult } = await supabase
              .from("pedidos")
              .update({ envio_id: newEnvioId })
              .eq("id", pedidoId)
              .is("envio_id", null)
              .select("id")
              .maybeSingle();

            if (updateResult) {
              supabase.functions.invoke("auto-whatsapp-new-order", {
                body: { envio_id: newEnvioId, loja_id: lojaId }
              }).catch((err) => console.error("[auto-whatsapp]", err));

              supabase.functions.invoke("advance-shipments", {
                body: { envio_id: newEnvioId, loja_id: lojaId },
              }).catch((err) => console.error("[advance-shipments]", err));

              supabase.functions.invoke("send-payment-confirmation", {
                body: { pedido_id: pedidoId, loja_id: lojaId }
              }).catch((err) => console.error("[payment-confirmation]", err));
            }
          }
        } else if (dedupeError) {
          console.error("[webhook-cloudfy] dedupe RPC error:", dedupeError);
        }
      }
    }

    await supabase
      .from("webhook_logs")
      .update({ processed: true })
      .eq("checkout_provider", "cloudfy")
      .eq("loja_id", lojaId)
      .order("created_at", { ascending: false })
      .limit(1);

    return new Response(
      JSON.stringify({ success: true, event_type: eventType || status, status }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook Cloudfy error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
