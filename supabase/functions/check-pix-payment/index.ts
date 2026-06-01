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
        const cyberPayApiKey = Deno.env.get("CYBERPAY_API_KEY")!;

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
        const { paymentId } = body;

        if (!paymentId) {
            return new Response(
                JSON.stringify({ error: "paymentId é obrigatório" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Fetch pix_payment record
        const { data: pixPayment, error: findError } = await supabase
            .from("pix_payments")
            .select("*")
            .eq("id", paymentId)
            .maybeSingle();

        if (findError || !pixPayment) {
            return new Response(
                JSON.stringify({ error: "Pagamento não encontrado" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Verify ownership (user must own the payment or be admin)
        if (pixPayment.user_id !== user.id) {
            const { data: adminRole } = await supabase
                .from("user_roles")
                .select("role")
                .eq("user_id", user.id)
                .eq("role", "admin")
                .maybeSingle();
            if (!adminRole) {
                return new Response(
                    JSON.stringify({ error: "Sem permissão" }),
                    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
        }

        // Already processed
        if (pixPayment.status !== "PENDING") {
            return new Response(
                JSON.stringify({ success: true, status: pixPayment.status }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // No transaction_id yet (edge case)
        if (!pixPayment.transaction_id) {
            return new Response(
                JSON.stringify({ success: true, status: "PENDING" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Check payment status with CyberPay API
        const checkResponse = await fetch(
            `https://api.escalecyber.com/v1/payments/transactions/${pixPayment.transaction_id}`,
            {
                headers: { "X-API-Key": cyberPayApiKey },
            }
        );

        if (!checkResponse.ok) {
            const errText = await checkResponse.text();
            console.error("CyberPay check error:", checkResponse.status, errText);
            return new Response(
                JSON.stringify({ success: true, status: "PENDING" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const checkData = await checkResponse.json();
        const cyberStatus = checkData.data?.status;

        if (cyberStatus !== "APPROVED") {
            return new Response(
                JSON.stringify({ success: true, status: "PENDING", cyberStatus }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // === Payment APPROVED — credit coins ===

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
            tipo: "adicao",
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
                    tipo: "adicao",
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

        // 5. Dispatch notification webhooks (fire-and-forget)
        try {
            const { data: activeWebhooks } = await supabase
                .from("admin_payment_webhooks")
                .select("url")
                .eq("ativo", true);

            if (activeWebhooks && activeWebhooks.length > 0) {
                const { data: userProfile } = await supabase
                    .from("profiles")
                    .select("full_name, email")
                    .eq("id", pixPayment.user_id)
                    .maybeSingle();

                const webhookPayload = {
                    evento: "recarga_pix",
                    usuario: userProfile?.full_name || "Desconhecido",
                    email: userProfile?.email || "",
                    valor: `R$ ${(pixPayment.amount_cents / 100).toFixed(2).replace(".", ",")}`,
                    moedas: Number(pixPayment.moedas),
                    data: new Date().toISOString(),
                };

                for (const wh of activeWebhooks) {
                    fetch(wh.url, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(webhookPayload),
                    }).catch((err) => console.error("Webhook dispatch error:", wh.url, err));
                }
                console.log(`Dispatched ${activeWebhooks.length} notification webhooks`);
            }
        } catch (whErr) {
            console.error("Error dispatching notification webhooks:", whErr);
        }

        console.log("Payment processed:", pixPayment.id, "User:", pixPayment.user_id, "Moedas:", pixPayment.moedas);

        // Auto-retry failed sends (insufficient balance) for this user
        fetch(`${supabaseUrl}/functions/v1/retry-failed-sends`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({ user_id: pixPayment.user_id }),
        }).catch((err) => console.error("retry-failed-sends dispatch error:", err));

        return new Response(
            JSON.stringify({ success: true, status: "PAID" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("check-pix-payment error:", error);
        return new Response(
            JSON.stringify({ error: "Erro interno do servidor" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
