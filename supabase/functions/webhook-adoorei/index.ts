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
            .eq("checkout_id", "adoorei")
            .maybeSingle();

        if (integrationStatus?.ativo === false) {
            return new Response(
                JSON.stringify({ success: true, skipped: true, reason: "integration_disabled" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const event = payload.event || "";
        const resource = payload.resource || {};
        const status = resource.status || "";
        const transactionToken = String(resource.number || `adoorei_${Date.now()}`);

        // 1. Log the webhook
        await supabase.from("webhook_logs").insert({
            checkout_provider: "adoorei",
            event_type: event,
            status: status,
            payload: payload,
            processed: false,
            loja_id: lojaId,
        });

        // === CARRINHO ABANDONADO (early return) ===
        if (event === "cart.abandoned") {
            const cartCustomer = resource.customer || {};
            const cartEmail = cartCustomer.email || "";
            if (cartEmail) {
                const recoveryTipo = "carrinho";
                const { data: recoveryConfig } = await supabase
                    .from("recovery_config")
                    .select("ativo, enviar_sms")
                    .eq("loja_id", lojaId)
                    .eq("tipo", recoveryTipo)
                    .eq("ativo", true)
                    .maybeSingle();

                if (recoveryConfig) {
                    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                    const { data: existingLead } = await supabase
                        .from("recovery_leads")
                        .select("id")
                        .eq("loja_id", lojaId)
                        .eq("customer_email", cartEmail)
                        .eq("tipo", recoveryTipo)
                        .gte("created_at", since24h)
                        .maybeSingle();

                    if (!existingLead) {
                        const cartProducts = (resource.products || []).map((p: any) => ({
                            name: p.name || "Produto",
                            value: Number(p.price || 0),
                            qty: Number(p.qty || 1),
                        }));
                        const phoneLimpo = cartCustomer.phone_number ? cartCustomer.phone_number.replace(/\D/g, '') : "";

                        const { data: newLead } = await supabase
                            .from("recovery_leads")
                            .insert({
                                loja_id: lojaId,
                                tipo: recoveryTipo,
                                customer_name: cartCustomer.name || "Cliente",
                                customer_email: cartEmail,
                                customer_phone: phoneLimpo,
                                checkout_url: resource.checkout_url || "",
                                total_value: Number(resource.total || 0),
                                products: cartProducts,
                                raw_payload: payload,
                                status: "pendente",
                            })
                            .select("id")
                            .single();

                        if (newLead) {
                            supabase.functions.invoke("send-recovery-email", {
                                body: { lead_id: newLead.id, loja_id: lojaId, tipo: recoveryTipo },
                            }).catch((e) => console.error("[recovery-email] error:", e));

                            if (recoveryConfig.enviar_sms && phoneLimpo) {
                                supabase.functions.invoke("send-recovery-sms", {
                                    body: { lead_id: newLead.id, loja_id: lojaId, tipo: recoveryTipo },
                                }).catch((e) => console.error("[recovery-sms] error:", e));
                            }
                        }
                    }
                }
            }

            await supabase.from("webhook_logs").update({ processed: true }).eq("checkout_provider", "adoorei").eq("loja_id", lojaId).order("created_at", { ascending: false }).limit(1);
            return new Response(JSON.stringify({ success: true, event, recovery: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // 2. Normalize data
        const customer = resource.customer || {};
        const address = resource.address || {};
        const items = resource.items || [];

        // Adoorei value_total comes as float e.g., 110.00. We convert to cents.
        const totalPriceInCents = Math.round(Number(resource.value_total || 0) * 100);

        const normalizedProducts = items.map((p: any) => ({
            code: String(p.source_reference || ""),
            title: p.name || (p.source_reference ? `Produto #${p.source_reference}` : "Produto Adoorei"),
            quantity: Number(p.quantity || 1),
            amount: Math.round(Number(p.price || 0) * 100),
        }));

        // 3. Upsert into pedidos
        const docLimpo = customer.doc ? customer.doc.replace(/\D/g, '') : null;
        const phoneLimpo = customer.phone ? customer.phone.replace(/\D/g, '') : null;

        const pedidoData = {
            checkout_provider: "adoorei",
            transaction_token: transactionToken,
            status: status,
            method: resource.payment_method || null,
            total_price: totalPriceInCents,
            customer_name: `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || null,
            customer_document: docLimpo,
            customer_email: customer.email || null,
            customer_phone: phoneLimpo,
            address_street: address.street || null,
            address_number: address.number || null,
            address_district: address.neighborhood || null,
            address_zip_code: address.zipcode || null,
            address_city: address.city || null,
            address_state: address.uf || null,
            address_country: address.country || "BR",
            address_complement: address.complement || null,
            products: normalizedProducts,
            raw_payload: payload,
            loja_id: lojaId,
        };

        const { data: existingPedido } = await supabase
            .from("pedidos")
            .select("id, envio_id")
            .eq("checkout_provider", "adoorei")
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

        // === PIX PENDENTE recovery ===
        const paymentMethod = (resource.payment_method || "").toLowerCase();
        if ((event === "order.created" || event === "order.status.updated") && status === "pending" && paymentMethod.includes("pix")) {
            const custEmail = customer.email || "";
            if (custEmail) {
                const recoveryTipo = "pix_pendente";
                const { data: recoveryConfig } = await supabase
                    .from("recovery_config")
                    .select("ativo, enviar_sms")
                    .eq("loja_id", lojaId)
                    .eq("tipo", recoveryTipo)
                    .eq("ativo", true)
                    .maybeSingle();

                if (recoveryConfig) {
                    // Deduplicação por transaction_token (number do pedido)
                    const { data: existingLead } = await supabase
                        .from("recovery_leads")
                        .select("id")
                        .eq("loja_id", lojaId)
                        .eq("tipo", recoveryTipo)
                        .filter("raw_payload->resource->>number", "eq", String(resource.number || ""))
                        .maybeSingle();

                    if (!existingLead) {
                        const recoveryProducts = normalizedProducts.map((p: any) => ({
                            name: p.title || "Produto",
                            value: p.amount / 100,
                            qty: p.quantity || 1,
                        }));
                        const custPhone = phoneLimpo || "";

                        const { data: newLead } = await supabase
                            .from("recovery_leads")
                            .insert({
                                loja_id: lojaId,
                                tipo: recoveryTipo,
                                customer_name: pedidoData.customer_name || "Cliente",
                                customer_email: custEmail,
                                customer_phone: custPhone,
                                checkout_url: "",
                                total_value: totalPriceInCents / 100,
                                products: recoveryProducts,
                                raw_payload: payload,
                                status: "pendente",
                            })
                            .select("id")
                            .single();

                        if (newLead) {
                            supabase.functions.invoke("send-recovery-email", {
                                body: { lead_id: newLead.id, loja_id: lojaId, tipo: recoveryTipo },
                            }).catch((e) => console.error("[recovery-email] error:", e));

                            if (recoveryConfig.enviar_sms && custPhone) {
                                supabase.functions.invoke("send-recovery-sms", {
                                    body: { lead_id: newLead.id, loja_id: lojaId, tipo: recoveryTipo },
                                }).catch((e) => console.error("[recovery-sms] error:", e));
                            }
                        }
                    }
                }
            }
        }

        // 4. If approved and no envio linked yet, create envio (with payment method filter)
        if (status === "approved" && !existingPedido?.envio_id && pedidoId) {
            const { data: integrationConfig } = await supabase
                .from("checkout_integrations")
                .select("filtro_metodo")
                .eq("loja_id", lojaId)
                .eq("checkout_id", "adoorei")
                .maybeSingle();

            const filtroMetodo = integrationConfig?.filtro_metodo || "todos";
            const methodValue = (resource.payment_method || "").toLowerCase();
            const isPix = methodValue.includes("pix");
            const shouldCreateEnvio = filtroMetodo === "todos" || (filtroMetodo === "cartao" && !isPix) || (filtroMetodo === "pix" && isPix);

            if (!shouldCreateEnvio) {
                await supabase.from("webhook_logs").update({ processed: true }).eq("checkout_provider", "adoorei").eq("loja_id", lojaId).order("created_at", { ascending: false }).limit(1);
                return new Response(JSON.stringify({ success: true, event, status, envio_skipped: true, reason: `filtro_metodo=${filtroMetodo}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            const produtoJson = JSON.stringify(
                normalizedProducts.map((p: any) => ({ nome: p.title, quantidade: p.quantity }))
            );
            const totalQuantidade = normalizedProducts.reduce((sum: number, p: any) => sum + p.quantity, 0) || 1;

            // Buscar empresa da loja
            const { data: empresaData } = await supabase
                .from("empresas")
                .select("id")
                .eq("loja_id", lojaId)
                .maybeSingle();

            const envioData = {
                cliente_nome: `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "Cliente Adoorei",
                cliente_email: customer.email || "sem-email@adoorei.com",
                cliente_cpf: docLimpo,
                cliente_telefone: phoneLimpo,
                cliente_endereco: address.street || null,
                cliente_numero: address.number || null,
                cliente_bairro: address.neighborhood || null,
                cliente_cep: address.zipcode ? address.zipcode.replace(/\D/g, '') : null,
                cliente_cidade: address.city || null,
                cliente_estado: address.uf || null,
                cliente_complemento: address.complement || null,
                produto: produtoJson,
                quantidade: totalQuantidade,
                valor: totalPriceInCents / 100, // Saving valor as decimal in envios table
                status: "pendente",
                loja_id: lojaId,
                empresa_id: empresaData?.id || null,
            };

            // GLOBAL DEDUPE: bloqueia envio duplicado (mesmo email + valor + loja) na última 1h
            const _oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            const { data: _recentDup } = await supabase
                .from("envios")
                .select("id")
                .eq("loja_id", lojaId)
                .eq("cliente_email", envioData.cliente_email)
                .eq("valor", envioData.valor)
                .is("deleted_at", null)
                .gte("created_at", _oneHourAgo)
                .limit(1)
                .maybeSingle();
            if (_recentDup) {
                console.log("[webhook-adoorei] Duplicate envio blocked:", _recentDup.id);
                await supabase.from("pedidos").update({ envio_id: _recentDup.id }).eq("id", pedidoId).is("envio_id", null);
                return new Response(JSON.stringify({ success: true, dedupe: true, envio_id: _recentDup.id }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

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
                    console.log("[webhook-adoorei] Race condition detected, deleting duplicate envio:", newEnvio.id);
                    await supabase.from("envios").delete().eq("id", newEnvio.id);
                } else {
                    supabase.functions.invoke("auto-whatsapp-new-order", {
                        body: { envio_id: newEnvio.id, loja_id: lojaId }
                    }).catch((err) => console.error("[auto-whatsapp] invoke error:", err));

                    supabase.functions.invoke("advance-shipments", { body: {} })
                        .catch((err) => console.error("[advance-shipments] invoke error:", err));

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
            .eq("checkout_provider", "adoorei")
            .eq("loja_id", lojaId)
            .order("created_at", { ascending: false })
            .limit(1);

        return new Response(
            JSON.stringify({ success: true, event, status }),
            {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    } catch (error) {
        console.error("Webhook Adoorei error:", error);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});
