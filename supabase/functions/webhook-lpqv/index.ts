import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeStatus(raw: string): string {
  const s = (raw || "").toLowerCase();
  if (["payment_accept", "order.paid", "paid", "approved"].includes(s)) return "paid";
  if (["order_created", "order.created", "awaiting_payment", "authorized_payment"].includes(s)) return "waiting_payment";
  if (["checkout.abandoned", "abandoned"].includes(s)) return "abandoned";
  if (["canceled", "order.canceled", "cancelled"].includes(s)) return "canceled";
  if (["separating_items", "dispatched", "delivered", "order.updated"].includes(s)) return "updated";
  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing 'token' query parameter" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    // LPQV format: { signature, slug-landingpage, response: {...}, event? }
    // Some payloads carry event inside response
    const resp: any = body.response || body;
    const eventType: string = body.event || resp.event || "";
    const status = normalizeStatus(eventType || resp.status || "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: lojaData } = await supabase
      .from("lojas").select("id").eq("webhook_token", token).maybeSingle();

    if (!lojaData) {
      return new Response(JSON.stringify({ error: "Loja not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const lojaId = lojaData.id;

    const { data: integrationStatus } = await supabase
      .from("checkout_integrations")
      .select("ativo, filtro_metodo")
      .eq("loja_id", lojaId).eq("checkout_id", "lpqv").maybeSingle();

    if (integrationStatus?.ativo === false) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "integration_disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const transactionToken = String(resp.token || resp.id || `lpqv_${Date.now()}`);

    await supabase.from("webhook_logs").insert({
      checkout_provider: "lpqv",
      event_type: eventType || status,
      status, payload: body, processed: false, loja_id: lojaId,
    });

    // ------- Normalize fields -------
    const customerName = resp.customer_name || "";
    const customerEmail = resp.customer_email || "";
    const customerPhone = resp.phone_number || resp.customer_cell || "";
    const customerDoc = resp.customer_cpf || "";

    const addr = (resp.orders_delivery_address && resp.orders_delivery_address[0]) || {};
    const items: any[] = resp.orders_products || resp.produtos || [];

    const totalValue = Number(
      resp.payment_total || resp.payment_in_cash ||
      items.reduce((s: number, it: any) => s + Number(it.product_price || it.sale_price || 0) * Number(it.product_qtdy || it.quantity || 1), 0) ||
      0
    );
    const totalPriceCents = Math.round(totalValue * 100);
    const paymentMethod = (resp.orders_transactions && resp.orders_transactions[0]?.processor) || "";

    const normalizedProducts = items.map((it: any) => ({
      code: String(it.product_id || it.id || it.product_variant_sku || ""),
      title: it.product_description || it.title_prod || it.title || "Produto",
      quantity: Number(it.product_qtdy || it.quantity || 1),
      amount: Math.round(Number(it.product_price || it.sale_price || 0) * 100),
    }));

    // ------- Recovery (checkout abandonado / aguardando pagamento) -------
    if (status === "abandoned" || status === "waiting_payment") {
      if (customerEmail) {
        const recoveryTipo = "carrinho";
        const { data: recoveryConfig } = await supabase
          .from("recovery_config").select("ativo")
          .eq("loja_id", lojaId).eq("tipo", recoveryTipo).maybeSingle();

        if (recoveryConfig?.ativo) {
          const recoveryProducts = items.map((it: any) => ({
            name: it.product_description || it.title_prod || "Produto",
            value: Number(it.product_price || it.sale_price || 0),
            qty: Number(it.product_qtdy || it.quantity || 1),
          }));

          const { data: insertedLead, error: insertErr } = await supabase
            .from("recovery_leads")
            .insert({
              loja_id: lojaId,
              customer_name: customerName,
              customer_email: customerEmail,
              customer_phone: customerPhone,
              products: recoveryProducts,
              total_value: totalValue,
              checkout_url: resp.checkout_url || resp.cart_url || "",
              raw_payload: resp,
              status: "pendente",
              tipo: recoveryTipo,
            })
            .select("id").maybeSingle();

          if (!insertErr && insertedLead) {
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

    // ------- Upsert pedido -------
    const pedidoData = {
      checkout_provider: "lpqv",
      transaction_token: transactionToken,
      status,
      method: paymentMethod || null,
      total_price: totalPriceCents,
      customer_name: customerName || null,
      customer_document: customerDoc || null,
      customer_email: customerEmail || null,
      customer_phone: customerPhone || null,
      address_street: addr.address || null,
      address_number: addr.number ? String(addr.number) : null,
      address_district: addr.district || null,
      address_zip_code: addr.zip_code || null,
      address_city: addr.city || null,
      address_state: addr.state || null,
      address_country: addr.country || "BR",
      address_complement: addr.complement || null,
      products: normalizedProducts,
      raw_payload: resp,
      loja_id: lojaId,
    };

    const { data: existingPedido } = await supabase
      .from("pedidos").select("id, envio_id")
      .eq("checkout_provider", "lpqv")
      .eq("transaction_token", transactionToken)
      .eq("loja_id", lojaId).maybeSingle();

    let pedidoId: string | undefined;
    if (existingPedido) {
      await supabase.from("pedidos")
        .update({ ...pedidoData, updated_at: new Date().toISOString() })
        .eq("id", existingPedido.id);
      pedidoId = existingPedido.id;
    } else {
      const { data: newPedido } = await supabase
        .from("pedidos").insert(pedidoData).select("id").single();
      pedidoId = newPedido?.id;
    }

    // ------- Cria envio quando pago -------
    if (status === "paid" && !existingPedido?.envio_id && pedidoId) {
      const filtroMetodo = integrationStatus?.filtro_metodo || "todos";
      const methodValue = (paymentMethod || "").toLowerCase();
      const isPix = methodValue.includes("pix");
      const shouldCreateEnvio = filtroMetodo === "todos" ||
        (filtroMetodo === "cartao" && !isPix) ||
        (filtroMetodo === "pix" && isPix);

      if (shouldCreateEnvio) {
        const produtoJson = JSON.stringify(
          normalizedProducts.map((p: any) => ({ nome: p.title, quantidade: p.quantity || 1 }))
        );
        const totalQuantidade = normalizedProducts.reduce((s: number, p: any) => s + (p.quantity || 1), 0);

        const { data: empresaData } = await supabase
          .from("empresas").select("id").eq("loja_id", lojaId).maybeSingle();

        const envioData = {
          cliente_nome: customerName || addr.recipient || "Cliente LPQV",
          cliente_email: customerEmail || "sem-email@lpqv.com",
          cliente_cpf: customerDoc || null,
          cliente_telefone: customerPhone || null,
          cliente_endereco: addr.address || null,
          cliente_numero: addr.number ? String(addr.number) : null,
          cliente_bairro: addr.district || null,
          cliente_cep: addr.zip_code || null,
          cliente_cidade: addr.city || null,
          cliente_estado: addr.state || null,
          cliente_complemento: addr.complement || null,
          produto: produtoJson || "Produto LPQV",
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
          }).maybeSingle();

        if (!dedupeError && dedupeResult) {
          const newEnvioId = (dedupeResult as any).envio_id;
          const wasDuplicate = (dedupeResult as any).was_duplicate === true;

          if (wasDuplicate) {
            await supabase.from("pedidos").update({ envio_id: newEnvioId })
              .eq("id", pedidoId).is("envio_id", null);
            supabase.functions.invoke("send-payment-confirmation", {
              body: { pedido_id: pedidoId, loja_id: lojaId }
            }).catch((e) => console.error("[payment-confirmation]", e));
          } else {
            const { data: updateResult } = await supabase.from("pedidos")
              .update({ envio_id: newEnvioId })
              .eq("id", pedidoId).is("envio_id", null)
              .select("id").maybeSingle();

            if (updateResult) {
              supabase.functions.invoke("auto-whatsapp-new-order", {
                body: { envio_id: newEnvioId, loja_id: lojaId }
              }).catch((e) => console.error("[auto-whatsapp]", e));
              supabase.functions.invoke("advance-shipments", {
                body: { envio_id: newEnvioId, loja_id: lojaId },
              }).catch((e) => console.error("[advance-shipments]", e));
              supabase.functions.invoke("send-payment-confirmation", {
                body: { pedido_id: pedidoId, loja_id: lojaId }
              }).catch((e) => console.error("[payment-confirmation]", e));
            }
          }
        } else if (dedupeError) {
          console.error("[webhook-lpqv] dedupe error:", dedupeError);
        }
      }
    }

    // ------- Cancelamento -------
    if (status === "canceled" && existingPedido) {
      await supabase.from("pedidos")
        .update({ status: "canceled", updated_at: new Date().toISOString() })
        .eq("id", existingPedido.id);
    }

    await supabase.from("webhook_logs").update({ processed: true })
      .eq("checkout_provider", "lpqv").eq("loja_id", lojaId)
      .order("created_at", { ascending: false }).limit(1);

    return new Response(
      JSON.stringify({ success: true, event_type: eventType || status, status }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook LPQV error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
