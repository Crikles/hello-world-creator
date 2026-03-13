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
        const authHeader = req.headers.get("authorization") || "";
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const openPixApiKey = Deno.env.get("OPENPIX_API_KEY")!;

        // Verify user JWT
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

        const supabase = createClient(supabaseUrl, serviceRoleKey);
        const body = await req.json();
        const { amount_cents, moedas, target_user_id } = body;

        if (!amount_cents || !moedas || amount_cents < 100) {
            return new Response(
                JSON.stringify({ error: "Parâmetros inválidos. amount_cents mínimo: 100" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Admin impersonation check
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
                    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
            effectiveUserId = target_user_id;
        }

        // Get profile for customer info
        const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email, whatsapp")
            .eq("id", effectiveUserId)
            .maybeSingle();

        const customerName = profile?.full_name || profile?.email?.split("@")[0] || "Cliente";
        const customerEmail = profile?.email || "cliente@email.com";
        const customerPhone = profile?.whatsapp?.replace(/\D/g, "") || "00000000000";

        // Insert pix_payment record (use its ID as correlationID)
        const { data: pixPayment, error: insertError } = await supabase
            .from("pix_payments")
            .insert({
                user_id: effectiveUserId,
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
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Call Woovi/OpenPix API to create charge
        const openPixPayload = {
            correlationID: pixPayment.id,
            value: amount_cents,
            comment: `Recarga ${moedas} moedas`,
            customer: {
                name: customerName,
                email: customerEmail,
                phone: customerPhone,
                correlationID: effectiveUserId,
            },
            additionalInfo: [
                { key: "user_id", value: effectiveUserId },
                { key: "moedas", value: String(moedas) },
            ],
        };

        const openPixResponse = await fetch(
            "https://api.openpix.com.br/api/v1/charge",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: openPixApiKey,
                },
                body: JSON.stringify(openPixPayload),
            }
        );

        const openPixData = await openPixResponse.json();

        if (!openPixResponse.ok || !openPixData.brCode) {
            console.error("OpenPix error:", openPixData);
            await supabase.from("pix_payments").delete().eq("id", pixPayment.id);
            return new Response(
                JSON.stringify({
                    error: "Erro ao gerar PIX",
                    details: openPixData.error || openPixData.message,
                }),
                { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const charge = openPixData.charge;
        const transactionId = charge?.transactionID || charge?.correlationID || pixPayment.id;
        const qrCodeImageUrl = charge?.qrCodeImage || "";
        const brCode = openPixData.brCode || "";

        // Update pix_payments with transaction data
        await supabase
            .from("pix_payments")
            .update({
                transaction_id: transactionId,
                qr_code_base64: qrCodeImageUrl,
                copy_paste: brCode,
            })
            .eq("id", pixPayment.id);

        return new Response(
            JSON.stringify({
                success: true,
                data: {
                    paymentId: pixPayment.id,
                    transactionId,
                    qrCodeBase64: qrCodeImageUrl,
                    copyPaste: brCode,
                    amount_cents,
                    moedas,
                },
            }),
            { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("create-pix-payment error:", error);
        return new Response(
            JSON.stringify({ error: "Erro interno do servidor" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
