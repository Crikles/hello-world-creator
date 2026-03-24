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
