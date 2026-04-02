import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/* ─── Normalizer helpers ─── */

function extractDocument(doc: string | undefined | null): string | null {
  if (!doc) return null;
  const parts = doc.split(":");
  return parts.length > 1 ? parts[1] : doc;
}

function resolveCustomer(payload: any) {
  const src = payload.client || payload.customer || payload.buyer || {};
  const name = src.name || src.full_name || src.nome || "";
  const email = src.email || "";
  const phone = src.phone || src.cellphone || src.telefone || "";
  const doc = extractDocument(src.doc || src.document || src.cpf || null);

  // Derive name from email if missing
  const safeName = name.trim() || (email ? email.split("@")[0].replace(/[._-]/g, " ") : "Cliente");

  return { name: safeName, email, phone, doc };
}

function resolveAddress(payload: any) {
  const addr = payload.address || payload.shipping_address || payload.endereco || {};
  return {
    street: addr.street || addr.rua || addr.endereco || null,
    number: addr.number || addr.numero || null,
    neighborhood: addr.neighborhood || addr.district || addr.bairro || null,
    zipcode: addr.zipcode || addr.zip_code || addr.cep || null,
    city: addr.city || addr.cidade || null,
    state: addr.state || addr.estado || null,
    complement: addr.complement || addr.complemento || null,
  };
}

function resolveItems(payload: any): Array<{ id: string; name: string; quantity: number; price: number }> {
  const raw = payload.items || payload.products || payload.line_items || [];
  if (!Array.isArray(raw) || raw.length === 0) return [];

  return raw.map((item: any) => ({
    id: String(item.id || item.code || ""),
    name: item.name || item.title || item.nome || item.product_name || "Produto",
    quantity: Number(item.quantity || item.qty || 1),
    price: Number(item.price || item.value || item.amount || 0),
  }));
}

function resolveTotal(payload: any, items: Array<{ price: number; quantity: number }>): number {
  const declared = Number(payload.amount || payload.total || payload.value || 0);
  if (declared > 0) return declared;
  // Fallback: sum items
  return items.reduce((sum, i) => sum + i.price * i.quantity, 0);
}

/* ─── Main handler ─── */

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
      .eq("checkout_id", "corvex")
      .maybeSingle();

    if (integrationStatus?.ativo === false) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "integration_disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const event = payload.event || "";
    const status = payload.status || "";
    const transactionToken = payload.id || `corvex_${Date.now()}`;

    // Map event to event_type
    const eventTypeMap: Record<string, string> = {
      "corvex.order.paid": "sale",
      "corvex.order.created": "created",
      "corvex.order.cancelled": "cancelled",
      "corvex.order.refunded": "refunded",
      "corvex.order.pending": "pending",
    };
    const eventType = eventTypeMap[event] || event;

    // ── Normalize all data once ──
    const customer = resolveCustomer(payload);
    const address = resolveAddress(payload);
    const items = resolveItems(payload);
    const totalDecimal = resolveTotal(payload, items);
    const totalCents = Math.round(totalDecimal * 100);

    const normalizedProducts = items.map((item) => ({
      code: item.id,
      title: item.name,
      quantity: item.quantity,
      amount: Math.round(item.price * 100),
    }));

    console.log("[corvex] normalized:", { customer, totalDecimal, itemCount: items.length });

    // 1. Log the webhook
    await supabase.from("webhook_logs").insert({
      checkout_provider: "corvex",
      event_type: eventType,
      status,
      payload,
      processed: false,
      loja_id: lojaId,
    });

    // 2. Upsert into pedidos
    const pedidoData = {
      checkout_provider: "corvex",
      transaction_token: transactionToken,
      status,
      method: payload.method || null,
      total_price: totalCents,
      customer_name: customer.name,
      customer_document: customer.doc,
      customer_email: customer.email || null,
      customer_phone: customer.phone || null,
      address_street: address.street,
      address_number: address.number,
      address_district: address.neighborhood,
      address_zip_code: address.zipcode,
      address_city: address.city,
      address_state: address.state,
      address_country: null,
      address_complement: address.complement,
      products: normalizedProducts,
      raw_payload: payload,
      loja_id: lojaId,
    };

    const { data: existingPedido } = await supabase
      .from("pedidos")
      .select("id, envio_id")
      .eq("checkout_provider", "corvex")
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

    // 3. Recovery: PIX pendente ou carrinho abandonado
    const isPendingEvent = status === "pending";
    if (isPendingEvent && customer.email) {
      const methodLower = (payload.method || "").toLowerCase();
      const recoveryTipo = methodLower.includes("pix") ? "pix_pendente" : "carrinho";

      try {
        const { data: recoveryConfig } = await supabase
          .from("recovery_config")
          .select("ativo")
          .eq("loja_id", lojaId)
          .eq("tipo", recoveryTipo)
          .maybeSingle();

        if (recoveryConfig?.ativo) {
          if (!existingPedido) {
            const recoveryProducts = items.map((item) => ({
              name: item.name,
              value: item.price,
              qty: item.quantity,
            }));

            const checkoutUrl = payload.utm?.page?.url || payload.checkout_url || "";

            const { data: newLead } = await supabase
              .from("recovery_leads")
              .insert({
                loja_id: lojaId,
                customer_name: customer.name,
                customer_email: customer.email,
                customer_phone: customer.phone || null,
                products: recoveryProducts,
                total_value: totalDecimal,
                checkout_url: checkoutUrl,
                raw_payload: payload,
                status: "pendente",
                tipo: recoveryTipo,
              })
              .select("id")
              .single();

            if (newLead) {
              console.log("[corvex] recovery lead created:", newLead.id, { name: customer.name, total: totalDecimal });

              supabase.functions.invoke("send-recovery-email", {
                body: { lead_id: newLead.id, loja_id: lojaId, tipo: recoveryTipo },
              }).catch((e) => console.error("[recovery-email] error:", e));

              supabase.functions.invoke("send-recovery-sms", {
                body: { lead_id: newLead.id, loja_id: lojaId, tipo: recoveryTipo },
              }).catch((e) => console.error("[recovery-sms] error:", e));
            }
          } else {
            console.log("[recovery] skipping duplicate transaction", { transactionToken, lojaId, recoveryTipo });
          }
        }
      } catch (e) {
        console.error("[recovery] error:", e);
      }
    }

    // 4. If paid and no envio linked yet, create envio
    if (status === "paid" && !existingPedido?.envio_id && pedidoId) {
      const { data: integrationConfig } = await supabase
        .from("checkout_integrations")
        .select("filtro_metodo")
        .eq("loja_id", lojaId)
        .eq("checkout_id", "corvex")
        .maybeSingle();

      const filtroMetodo = integrationConfig?.filtro_metodo || "todos";
      const methodValue = (payload.method || "").toLowerCase();
      const isPix = methodValue.includes("pix");
      const shouldCreateEnvio = filtroMetodo === "todos" || (filtroMetodo === "cartao" && !isPix) || (filtroMetodo === "pix" && isPix);

      if (!shouldCreateEnvio) {
        await supabase.from("webhook_logs").update({ processed: true }).eq("checkout_provider", "corvex").eq("loja_id", lojaId).order("created_at", { ascending: false }).limit(1);
        return new Response(JSON.stringify({ success: true, event_type: eventType, status, envio_skipped: true, reason: `filtro_metodo=${filtroMetodo}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const produtoJson = JSON.stringify(
        items.map((p) => ({ nome: p.name, quantidade: p.quantity }))
      );
      const totalQuantidade = items.reduce((sum, p) => sum + p.quantity, 0);

      const { data: empresaData } = await supabase
        .from("empresas")
        .select("id")
        .eq("loja_id", lojaId)
        .maybeSingle();

      const envioData = {
        cliente_nome: customer.name,
        cliente_email: customer.email || "sem-email@corvex.com",
        cliente_cpf: customer.doc,
        cliente_telefone: customer.phone || null,
        cliente_endereco: address.street,
        cliente_numero: address.number,
        cliente_bairro: address.neighborhood,
        cliente_cep: address.zipcode,
        cliente_cidade: address.city,
        cliente_estado: address.state,
        cliente_complemento: address.complement,
        produto: produtoJson || "Produto Corvex",
        quantidade: totalQuantidade || 1,
        valor: totalDecimal,
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

        supabase.functions.invoke("auto-whatsapp-new-order", {
          body: { envio_id: newEnvio.id, loja_id: lojaId }
        }).catch((err) => console.error("[auto-whatsapp] invoke error:", err));
      }
    }

    // 5. Mark webhook as processed
    await supabase
      .from("webhook_logs")
      .update({ processed: true })
      .eq("checkout_provider", "corvex")
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
    console.error("Webhook Corvex error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
