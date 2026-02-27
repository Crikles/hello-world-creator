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
        const event = payload.event || req.headers.get("X-Webhook-Event") || "";

        console.log("BlackCat webhook received:", JSON.stringify({ event, transactionId: payload.transactionId, status: payload.status }));

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, serviceRoleKey);

        // Handle transaction.paid event
        if (event === "transaction.paid" && payload.status === "PAID") {
            const transactionId = payload.transactionId;

            if (!transactionId) {
                console.error("Missing transactionId in webhook payload");
                return new Response(
                    JSON.stringify({ error: "Missing transactionId" }),
                    {
                        status: 400,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    }
                );
            }

            // Find the pix_payment record
            const { data: pixPayment, error: findError } = await supabase
                .from("pix_payments")
                .select("*")
                .eq("transaction_id", transactionId)
                .maybeSingle();

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
                tipo: "recarga_pix",
                quantidade: pixPayment.moedas,
                descricao: `Recarga via PIX - R$ ${(pixPayment.amount_cents / 100).toFixed(2)} - ${pixPayment.moedas} moedas`,
            });

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
