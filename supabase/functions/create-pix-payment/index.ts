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
        // Authenticate the user via Supabase JWT
        const authHeader = req.headers.get("authorization") || "";
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const blackcatApiKey = Deno.env.get("BLACKCAT_API_KEY")!;

        // Create an anon client to verify the user's JWT
        const supabaseAuth = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: authHeader } },
        });
        const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

        if (authError || !user) {
            return new Response(JSON.stringify({ error: "Não autorizado" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Create service role client for DB operations
        const supabase = createClient(supabaseUrl, serviceRoleKey);

        const body = await req.json();
        const { amount_cents, moedas, target_user_id } = body;

        if (!amount_cents || !moedas || amount_cents < 100) {
            return new Response(
                JSON.stringify({ error: "Parâmetros inválidos. amount_cents mínimo: 100" }),
                {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        // Determine effective user: allow admin to create PIX on behalf of another user
        let effectiveUserId = user.id;
        if (target_user_id && target_user_id !== user.id) {
            const { data: adminRole } = await supabase
                .from("user_roles")
                .select("role")
                .eq("user_id", user.id)
                .eq("role", "admin")
                .maybeSingle();
            if (!adminRole) {
                return new Response(
                    JSON.stringify({ error: "Sem permissão para criar PIX em nome de outro usuário" }),
                    {
                        status: 403,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    }
                );
            }
            effectiveUserId = target_user_id;
        }

        // Get user profile for customer info
        const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email, whatsapp")
            .eq("id", effectiveUserId)
            .maybeSingle();

        const customerName = profile?.full_name || user.email?.split("@")[0] || "Cliente";
        const customerEmail = profile?.email || user.email || "cliente@email.com";
        const customerPhone = profile?.whatsapp?.replace(/\D/g, "") || "00000000000";

        // Insert payment record first to get the ID for externalRef
        const { data: pixPayment, error: insertError } = await supabase
            .from("pix_payments")
            .insert({
                user_id: user.id,
                amount_cents,
                moedas,
                status: "PENDING",
            })
            .select("id")
            .single();

        if (insertError || !pixPayment) {
            console.error("Insert error:", insertError);
            return new Response(
                JSON.stringify({ error: "Erro ao criar registro de pagamento" }),
                {
                    status: 500,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        // Build the webhook URL for BlackCat postback
        const webhookUrl = `${supabaseUrl}/functions/v1/webhook-blackcat`;

        // Call BlackCat API to create sale
        const blackcatPayload = {
            amount: amount_cents,
            currency: "BRL",
            paymentMethod: "pix",
            items: [
                {
                    title: `Pacote de ${moedas} moedas`,
                    quantity: 1,
                    tangible: false,
                },
            ],
            customer: {
                name: customerName,
                email: customerEmail,
                phone: customerPhone,
                document: {
                    number: customerPhone,
                    type: "cpf",
                },
            },
            pix: {
                expiresInDays: 1,
            },
            postbackUrl: webhookUrl,
            externalRef: pixPayment.id,
            metadata: `Recarga ${moedas} moedas - User ${user.id}`,
        };

        const blackcatResponse = await fetch(
            "https://api.blackcatpagamentos.online/api/sales/create-sale",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": blackcatApiKey,
                },
                body: JSON.stringify(blackcatPayload),
            }
        );

        const blackcatData = await blackcatResponse.json();

        if (!blackcatResponse.ok || !blackcatData.success) {
            console.error("BlackCat error:", blackcatData);
            // Clean up the pending record
            await supabase.from("pix_payments").delete().eq("id", pixPayment.id);
            return new Response(
                JSON.stringify({
                    error: "Erro ao gerar PIX",
                    details: blackcatData.error || blackcatData.message,
                }),
                {
                    status: 502,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        const { transactionId, paymentData } = blackcatData.data;

        // Update pix_payments with transaction data
        await supabase
            .from("pix_payments")
            .update({
                transaction_id: transactionId,
                qr_code_base64: paymentData.qrCodeBase64,
                copy_paste: paymentData.copyPaste,
            })
            .eq("id", pixPayment.id);

        return new Response(
            JSON.stringify({
                success: true,
                data: {
                    paymentId: pixPayment.id,
                    transactionId,
                    qrCodeBase64: paymentData.qrCodeBase64,
                    copyPaste: paymentData.copyPaste,
                    expiresAt: paymentData.expiresAt,
                    amount_cents,
                    moedas,
                },
            }),
            {
                status: 201,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    } catch (error) {
        console.error("create-pix-payment error:", error);
        return new Response(
            JSON.stringify({ error: "Erro interno do servidor" }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});
