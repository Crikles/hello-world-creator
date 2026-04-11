import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode as decodeBase64 } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/* ── Helpers ── */

/** Parse a numeric value from raw input (strips non-numeric chars) */
function parseNumericValue(raw: unknown): number {
  if (raw == null) return 0;
  const n = Number(String(raw).replace(/[^0-9.-]/g, ""));
  if (isNaN(n)) return 0;
  return n;
}

/** Resolve checkout URL from multiple Vega payload fields */
function resolveCheckoutUrl(payload: Record<string, unknown>): string {
  return String(
    payload.order_url ||
    payload.checkout_url ||
    payload.abandoned_checkout_url_url ||
    payload.abandoned_checkout_url ||
    ""
  ).trim();
}

/** Extract products from Vega V1 (plans[].products[]) or V2 (products[])
 *  NOTE: Vega sends values already in Reais (e.g. 48.90), NOT centavos.
 */
function extractProducts(payload: Record<string, unknown>): Array<{
  code: string;
  title: string;
  description: string;
  amount: number; // Reais
  quantity: number;
}> {
  const products = payload.products as any[] | undefined;
  if (Array.isArray(products) && products.length > 0) {
    return products.map((p: any) => ({
      code: String(p.id || p.code || ""),
      title: String(p.name || p.title || "Produto"),
      description: String(p.description || ""),
      amount: parseNumericValue(p.value || p.amount || 0),
      quantity: Number(p.amount || p.quantity || 1),
    }));
  }
  // V1: plans[].products[]
  const plans = payload.plans as any[] | undefined;
  if (Array.isArray(plans)) {
    const result: any[] = [];
    for (const plan of plans) {
      if (Array.isArray(plan.products)) {
        for (const p of plan.products) {
          result.push({
            code: String(p.id || ""),
            title: String(p.name || "Produto"),
            description: String(p.description || ""),
            amount: parseNumericValue(p.value || plan.value || 0),
            quantity: Number(p.amount || 1),
          });
        }
      }
    }
    return result;
  }
  return [];
}

/** Clean base64 string (remove data URI prefix and whitespace) */
function cleanBase64(raw: string): string {
  if (!raw) return "";
  let cleaned = raw.trim();
  if (cleaned.includes(",") && cleaned.startsWith("data:")) {
    cleaned = cleaned.split(",")[1];
  }
  cleaned = cleaned.replace(/\s/g, "");
  return cleaned;
}

/** Upload base64 QR code image to storage, return public URL */
async function uploadQrToStorage(
  supabase: any,
  base64Raw: string,
  leadId: string,
  supabaseUrl: string
): Promise<string> {
  const cleaned = cleanBase64(base64Raw);
  if (!cleaned) return "";
  try {
    const bytes = decodeBase64(cleaned);
    const path = `qr_${leadId}_${Date.now()}.png`;
    const { error } = await supabase.storage
      .from("pix-qrcodes")
      .upload(path, bytes, {
        contentType: "image/png",
        upsert: true,
      });
    if (error) {
      console.error("[qr-upload] error:", error);
      return "";
    }
    return `${supabaseUrl}/storage/v1/object/public/pix-qrcodes/${path}`;
  } catch (e) {
    console.error("[qr-upload] exception:", e);
    return "";
  }
}

/* ── Main Handler ── */

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
      .eq("checkout_id", "vega")
      .maybeSingle();

    if (integrationStatus?.ativo === false) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "integration_disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const status = payload.status || "";
    const methodLower = (payload.method || "").toLowerCase();
    const isAbandonedCart = status === "abandoned_cart";
    const isPix = methodLower.includes("pix");
    const eventType = isAbandonedCart ? "abandoned_cart" : "sale";

    const transactionToken = isAbandonedCart
      ? payload.abandoned_cart_code || payload.checkout_id || `ac_${Date.now()}`
      : payload.transaction_token || payload.transaction_id || `tx_${Date.now()}`;

    // Normalize data
    const customer = payload.customer || {};
    const address = payload.address || {};
    const normalizedProducts = extractProducts(payload);

    // Vega sends total_price already in Reais (e.g. 48.90)
    const totalPriceReais = parseNumericValue(payload.total_price);
    const totalPriceCentavos = Math.round(totalPriceReais * 100);

    // Upsert into pedidos
    const pedidoData = {
      checkout_provider: "vega",
      transaction_token: transactionToken,
      status: status,
      method: payload.method || null,
      total_price: totalPriceCentavos,
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

    // Recovery: abandoned cart or pending pix
    const isPendingPix = status === "pending" && isPix;
    const isAbandonedPix = isAbandonedCart && isPix;

    if ((isAbandonedCart || isPendingPix) && customer.email) {
      const recoveryTipo = (isPendingPix || isAbandonedPix) ? "pix_pendente" : "carrinho";
      const email = customer.email.trim().toLowerCase();

      try {
        const { data: recoveryConfig } = await supabase
          .from("recovery_config")
          .select("ativo, enviar_sms")
          .eq("loja_id", lojaId)
          .eq("tipo", recoveryTipo)
          .maybeSingle();

        if (recoveryConfig?.ativo) {
          const checkoutUrl = resolveCheckoutUrl(payload);

          // Products for recovery lead: values already in Reais
          const recoveryProducts = normalizedProducts.map((p: any) => ({
            name: p.title || p.name || "Produto",
            value: p.amount || 0,
            qty: Number(p.quantity || 1),
          }));

          // PIX data
          const pixCode = String(payload.pix_code || "").trim();
          const pixBase64Raw = String(payload.pix_code_image64 || "").trim();

          // Upload QR code to storage if available
          let pixQrcodeUrl = "";
          if (pixBase64Raw) {
            const tempId = `${lojaId}_${Date.now()}`;
            pixQrcodeUrl = await uploadQrToStorage(supabase, pixBase64Raw, tempId, supabaseUrl);
          }

          console.log("[webhook-vega] Recovery data:", {
            tipo: recoveryTipo,
            total_value: totalPriceReais,
            checkout_url: checkoutUrl,
            pix_code_length: pixCode.length,
            pix_qrcode_url: pixQrcodeUrl ? "SET" : "EMPTY",
            products_count: recoveryProducts.length,
          });

          const { data: newLead } = await supabase
            .from("recovery_leads")
            .insert({
              loja_id: lojaId,
              customer_name: customer.name || "Cliente",
              customer_email: email,
              customer_phone: customer.phone || "",
              checkout_url: checkoutUrl,
              products: recoveryProducts,
              total_value: totalPriceReais,
              raw_payload: payload,
              tipo: recoveryTipo,
              status: "pendente",
              pix_code: pixCode,
              pix_qrcode_url: pixQrcodeUrl,
            })
            .select("id")
            .single();

          if (newLead) {
            // Fire-and-forget email
            supabase.functions.invoke("send-recovery-email", {
              body: { lead_id: newLead.id, loja_id: lojaId, tipo: recoveryTipo },
            }).catch((e: any) => console.error("[recovery-email] error:", e));

            // Fire-and-forget SMS
            if (recoveryConfig.enviar_sms && customer.phone) {
              supabase.functions.invoke("send-recovery-sms", {
                body: { lead_id: newLead.id, loja_id: lojaId, tipo: recoveryTipo },
              }).catch((e: any) => console.error("[recovery-sms] error:", e));
            }

            console.log(`[recovery] Lead created for ${recoveryTipo}:`, newLead.id);
          }
        }
      } catch (recErr) {
        console.error("[recovery] Error:", recErr);
      }
    }

    // If approved and no envio linked yet, create envio
    if (status === "approved" && !existingPedido?.envio_id && pedidoId) {
      const { data: integrationConfig } = await supabase
        .from("checkout_integrations")
        .select("filtro_metodo")
        .eq("loja_id", lojaId)
        .eq("checkout_id", "vega")
        .maybeSingle();

      const filtroMetodo = integrationConfig?.filtro_metodo || "todos";
      const shouldCreateEnvio = filtroMetodo === "todos" || (filtroMetodo === "cartao" && !isPix) || (filtroMetodo === "pix" && isPix);

      if (!shouldCreateEnvio) {
        await supabase.from("webhook_logs").update({ processed: true }).eq("checkout_provider", "vega").eq("loja_id", lojaId).order("created_at", { ascending: false }).limit(1);
        return new Response(JSON.stringify({ success: true, event_type: eventType, status, envio_skipped: true, reason: `filtro_metodo=${filtroMetodo}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const produtoJson = JSON.stringify(
        normalizedProducts.map((p: any) => ({ nome: p.title || p.name, quantidade: p.quantity || 1 }))
      );
      const totalQuantidade = normalizedProducts.reduce((sum: number, p: any) => sum + (p.quantity || 1), 0);

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
        valor: totalPriceReais,
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
          console.log("[webhook-vega] Race condition detected, deleting duplicate envio:", newEnvio.id);
          await supabase.from("envios").delete().eq("id", newEnvio.id);
        } else {
          supabase.functions.invoke("auto-whatsapp-new-order", {
            body: { envio_id: newEnvio.id, loja_id: lojaId }
          }).catch((err: any) => console.error("[auto-whatsapp] invoke error:", err));
        }
      }
    }

    // Mark webhook as processed
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
