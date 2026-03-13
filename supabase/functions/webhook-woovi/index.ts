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

    // Accept GET for health-check / webhook registration verification
    if (req.method === "GET") {
        return new Response(
            JSON.stringify({ success: true, message: "Webhook Woovi is active" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    try {
        let payload: any;
        try {
            payload = await req.json();
        } catch {
            // Empty or invalid JSON body (test/ping request)
            return new Response(
                JSON.stringify({ success: true, message: "OK" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const event = payload.event || "";
        const charge = payload.charge || payload.pix || {};

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const openPixApiKey = Deno.env.get("OPENPIX_API_KEY")!;
        const supabase = createClient(supabaseUrl, serviceRoleKey);

        console.log("Webhook Woovi received:", event, JSON.stringify(payload).slice(0, 500));

        const correlationID = charge.correlationID || payload.correlationID;
        const transactionID = charge.transactionID || payload.transactionID;

        // Only process payment completed events
        const isPaid = event === "OPENPIX:CHARGE_COMPLETED" ||
            event === "OPENPIX:TRANSACTION_RECEIVED" ||
            charge.status === "COMPLETED";

        if (!isPaid) {
            console.log("Non-payment event, acknowledging:", event);
            return new Response(
                JSON.stringify({ success: true, event }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!correlationID && !transactionID) {
            console.error("Missing correlationID and transactionID");
            return new Response(
                JSON.stringify({ error: "Missing transaction identifier" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Authoritative verification via OpenPix API
        if (correlationID) {
            try {
                console.log(`Verifying charge ${correlationID} with OpenPix API...`);
                const verifyResponse = await fetch(
                    `https://api.openpix.com.br/api/v1/charge/${correlationID}`,
                    { headers: { Authorization: openPixApiKey } }
                );

                if (verifyResponse.ok) {
                    const verifyData = await verifyResponse.json();
                    const apiStatus = verifyData.charge?.status;
                    console.log(`Authoritative status: ${apiStatus}`);
                    if (apiStatus !== "COMPLETED") {
                        console.log("Charge not COMPLETED per API, ignoring webhook");
                        return new Response(
                            JSON.stringify({ success: true, message: "Not completed" }),
                            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                        );
                    }
                } else {
                    console.error(`OpenPix status check failed: HTTP ${verifyResponse.status}`);
                }
            } catch (err) {
                console.error("Error verifying with OpenPix:", err);
            }
        }

        // Find pix_payment by correlationID (our pixPayment.id)
        let query = supabase.from("pix_payments").select("*");
        if (correlationID) {
            query = query.eq("id", correlationID);
        } else {
            query = query.eq("transaction_id", transactionID);
        }

        const { data: pixPayment, error: findError } = await query.maybeSingle();

        if (findError || !pixPayment) {
            console.error("PIX payment not found:", correlationID || transactionID, findError);
            return new Response(
                JSON.stringify({ error: "Payment not found" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Idempotency: only process PENDING
        if (pixPayment.status !== "PENDING") {
            console.log("Payment already processed:", pixPayment.id, pixPayment.status);
            return new Response(
                JSON.stringify({ success: true, message: "Already processed" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 1. Update status to PAID
        await supabase
            .from("pix_payments")
            .update({ status: "PAID", paid_at: new Date().toISOString() })
            .eq("id", pixPayment.id);

        // 2. Add credits
        const { data: existingCredits } = await supabase
            .from("creditos")
            .select("id, saldo")
            .eq("user_id", pixPayment.user_id)
            .maybeSingle();

        if (existingCredits) {
            await supabase
                .from("creditos")
                .update({
                    saldo: existingCredits.saldo + pixPayment.moedas,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", existingCredits.id);
        } else {
            await supabase.from("creditos").insert({
                user_id: pixPayment.user_id,
                saldo: pixPayment.moedas,
            });
        }

        // 3. Log transaction
        await supabase.from("creditos_transacoes").insert({
            user_id: pixPayment.user_id,
            tipo: "recarga_pix",
            quantidade: pixPayment.moedas,
            descricao: `Recarga via PIX - R$ ${(pixPayment.amount_cents / 100).toFixed(2)} - ${pixPayment.moedas} moedas`,
        });

        // 4. Referral commission (10%)
        const { data: buyerProfile } = await supabase
            .from("profiles")
            .select("referred_by")
            .eq("id", pixPayment.user_id)
            .maybeSingle();

        if (buyerProfile?.referred_by) {
            const commission = Math.floor(pixPayment.moedas * 0.10);
            if (commission > 0) {
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

                await supabase.from("creditos_transacoes").insert({
                    user_id: buyerProfile.referred_by,
                    tipo: "comissao_indicacao",
                    quantidade: commission,
                    descricao: `Comissão de indicação - ${commission} moedas (10%)`,
                });

                await supabase.from("referral_earnings").insert({
                    referrer_id: buyerProfile.referred_by,
                    referred_id: pixPayment.user_id,
                    pix_payment_id: pixPayment.id,
                    amount_earned: commission,
                });

                console.log("Referral commission:", commission, "to", buyerProfile.referred_by);
            }
        }

        console.log("Payment processed:", pixPayment.id, "User:", pixPayment.user_id, "Moedas:", pixPayment.moedas);

        return new Response(
            JSON.stringify({ success: true, message: "Payment processed" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Webhook error:", error);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
