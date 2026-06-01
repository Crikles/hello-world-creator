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
        const payload = await req.json();

        // Flatten payload to handle cases where it is wrapped in .data
        const data = payload.data || payload;

        const event = payload.event || req.headers.get("X-Webhook-Event") || "";
        const status = data.status || payload.status || "";
        const transactionId = data.transactionId || payload.transactionId || data.id || payload.id;
        const externalRef = data.externalRef || payload.externalRef || data.referenceId;

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const blackcatApiKey = Deno.env.get("BLACKCAT_API_KEY")!;
        const supabase = createClient(supabaseUrl, serviceRoleKey);

        let apiStatus = status;

        // VERIFY AUTHORITATIVELY WITH BLACKCAT API if we have a transactionId
        if (transactionId) {
            try {
                console.log(`Verifying authoritative status for transaction ${transactionId} with BlackCat API...`);
                const verifyResponse = await fetch(`https://api.blackcatpagamentos.online/api/sales/${transactionId}/status`, {
                    method: "GET",
                    headers: {
                        "X-API-Key": blackcatApiKey,
                    }
                });

                if (verifyResponse.ok) {
                    const verifyData = await verifyResponse.json();
                    if (verifyData.success && verifyData.data && verifyData.data.status) {
                        apiStatus = verifyData.data.status;
                        console.log(`Authoritative status fetched: ${apiStatus}`);
                    } else {
                        console.error("Non-success response from BlackCat status check:", verifyData);
                    }
                } else {
                    console.error(`Failed to fetch status from BlackCat API. HTTP ${verifyResponse.status}`);
                }
            } catch (err) {
                console.error("Error during authoritative status fetch:", err);
            }
        }

        const isPaid = apiStatus === "PAID" || apiStatus === "APPROVED" || apiStatus === "approved" || apiStatus === "paid" || (event && event.toLowerCase().includes("paid"));

        // Handle transaction.paid event
        if (isPaid) {
            if (!transactionId && !externalRef) {
                console.error("Missing transactionId and externalRef in webhook payload");
                return new Response(
                    JSON.stringify({ error: "Missing transaction identifier" }),
                    {
                        status: 400,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    }
                );
            }

            // Find the pix_payment record
            let query = supabase.from("pix_payments").select("*");

            // Prefer externalRef (which is our UUID) if valid, else fallback to transactionId
            if (externalRef && externalRef.length > 20) {
                query = query.eq("id", externalRef);
            } else {
                query = query.eq("transaction_id", transactionId);
            }

            const { data: pixPayment, error: findError } = await query.maybeSingle();

            if (findError || !pixPayment) {
                console.error("PIX payment not found for transaction:", transactionId, findError);
                return new Response(
                    JSON.stringify({ error: "Payment not found" }),
                    {
                        status: 404,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    }
                );
            }

            // Only process if still PENDING (idempotency)
            if (pixPayment.status !== "PENDING") {
                console.log("Payment already processed:", transactionId, pixPayment.status);
                return new Response(
                    JSON.stringify({ success: true, message: "Already processed" }),
                    {
                        status: 200,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    }
                );
            }

            // 1. Update pix_payments status to PAID
            await supabase
                .from("pix_payments")
                .update({
                    status: "PAID",
                    paid_at: new Date().toISOString(),
                })
                .eq("id", pixPayment.id);

            // 2. Add credits to user's balance
            const { data: existingCredits } = await supabase
                .from("creditos")
                .select("id, saldo")
                .eq("user_id", pixPayment.user_id)
                .maybeSingle();

            if (existingCredits) {
                // Update existing balance
                await supabase
                    .from("creditos")
                    .update({
                        saldo: existingCredits.saldo + pixPayment.moedas,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", existingCredits.id);
            } else {
                // Create new credits record
                await supabase.from("creditos").insert({
                    user_id: pixPayment.user_id,
                    saldo: pixPayment.moedas,
                });
            }

            // 3. Log the transaction
            await supabase.from("creditos_transacoes").insert({
                user_id: pixPayment.user_id,
                tipo: "adicao",
                quantidade: pixPayment.moedas,
                descricao: `Recarga via PIX - R$ ${(pixPayment.amount_cents / 100).toFixed(2)} - ${pixPayment.moedas} moedas`,
            });

            // 4. Referral commission (10% of purchased moedas)
            const { data: buyerProfile } = await supabase
                .from("profiles")
                .select("referred_by")
                .eq("id", pixPayment.user_id)
                .maybeSingle();

            if (buyerProfile?.referred_by) {
                const commission = Math.floor(pixPayment.moedas * 0.10);
                if (commission > 0) {
                    // Credit referrer
                    const { data: referrerCredits } = await supabase
                        .from("creditos")
                        .select("id, saldo")
                        .eq("user_id", buyerProfile.referred_by)
                        .maybeSingle();

                    if (referrerCredits) {
                        await supabase
                            .from("creditos")
                            .update({
                                saldo: referrerCredits.saldo + commission,
                                updated_at: new Date().toISOString(),
                            })
                            .eq("id", referrerCredits.id);
                    } else {
                        await supabase.from("creditos").insert({
                            user_id: buyerProfile.referred_by,
                            saldo: commission,
                        });
                    }

                    // Log referrer transaction
                    await supabase.from("creditos_transacoes").insert({
                        user_id: buyerProfile.referred_by,
                        tipo: "adicao",
                        quantidade: commission,
                        descricao: `Comissão de indicação - ${commission} moedas (10%)`,
                    });

                    // Log in referral_earnings
                    await supabase.from("referral_earnings").insert({
                        referrer_id: buyerProfile.referred_by,
                        referred_id: pixPayment.user_id,
                        pix_payment_id: pixPayment.id,
                        amount_earned: commission,
                    });

                    console.log("Referral commission credited:", commission, "to", buyerProfile.referred_by);
                }
            }

            console.log(
                "Payment processed successfully:",
                transactionId,
                "User:",
                pixPayment.user_id,
                "Moedas:",
                pixPayment.moedas
            );

            return new Response(
                JSON.stringify({ success: true, message: "Payment processed" }),
                {
                    status: 200,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        // Handle transaction.failed / cancelled
        if (event === "transaction.failed" && payload.transactionId) {
            await supabase
                .from("pix_payments")
                .update({ status: "CANCELLED" })
                .eq("transaction_id", payload.transactionId)
                .eq("status", "PENDING");

            console.log("Payment cancelled:", payload.transactionId);
        }

        // Acknowledge all other events
        return new Response(
            JSON.stringify({ success: true, event }),
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
