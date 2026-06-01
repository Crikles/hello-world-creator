import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const cyberPayApiKey = Deno.env.get("CYBERPAY_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch all PENDING pix_payments from last 24h with a transaction_id
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: pendingPayments, error: fetchErr } = await supabase
      .from("pix_payments")
      .select("*")
      .eq("status", "PENDING")
      .not("transaction_id", "is", null)
      .gte("created_at", cutoff)
      .limit(50);

    if (fetchErr) {
      console.error("Error fetching pending payments:", fetchErr);
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pendingPayments || pendingPayments.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${pendingPayments.length} pending PIX payments to check`);
    let processed = 0;

    for (const payment of pendingPayments) {
      try {
        // Check status with CyberPay
        const checkResponse = await fetch(
          `https://api.escalecyber.com/v1/payments/transactions/${payment.transaction_id}`,
          { headers: { "X-API-Key": cyberPayApiKey } }
        );

        if (!checkResponse.ok) {
          console.error(`CyberPay check failed for ${payment.id}: ${checkResponse.status}`);
          continue;
        }

        const checkData = await checkResponse.json();
        const cyberStatus = checkData.data?.status;

        if (cyberStatus !== "APPROVED") {
          continue;
        }

        // Double-check it's still PENDING (idempotency)
        const { data: freshPayment } = await supabase
          .from("pix_payments")
          .select("status")
          .eq("id", payment.id)
          .single();

        if (freshPayment?.status !== "PENDING") {
          continue;
        }

        // === APPROVED — credit coins ===

        // 1. Update status to PAID
        await supabase
          .from("pix_payments")
          .update({ status: "PAID", paid_at: new Date().toISOString() })
          .eq("id", payment.id);

        // 2. Add credits
        const { data: existingCredits } = await supabase
          .from("creditos")
          .select("id, saldo")
          .eq("user_id", payment.user_id)
          .maybeSingle();

        if (existingCredits) {
          await supabase
            .from("creditos")
            .update({
              saldo: existingCredits.saldo + payment.moedas,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingCredits.id);
        } else {
          await supabase.from("creditos").insert({
            user_id: payment.user_id,
            saldo: payment.moedas,
          });
        }

        // 3. Log transaction
        await supabase.from("creditos_transacoes").insert({
          user_id: payment.user_id,
          tipo: "adicao",
          quantidade: payment.moedas,
          descricao: `Recarga via PIX - R$ ${(payment.amount_cents / 100).toFixed(2)} - ${payment.moedas} moedas`,
        });

        // 4. Referral commission (10%)
        const { data: buyerProfile } = await supabase
          .from("profiles")
          .select("referred_by")
          .eq("id", payment.user_id)
          .maybeSingle();

        if (buyerProfile?.referred_by) {
          const commission = Math.floor(payment.moedas * 0.10);
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
              referred_id: payment.user_id,
              pix_payment_id: payment.id,
              amount_earned: commission,
            });
          }
        }

        // 5. Webhooks (fire-and-forget)
        try {
          const { data: activeWebhooks } = await supabase
            .from("admin_payment_webhooks")
            .select("url")
            .eq("ativo", true);

          if (activeWebhooks && activeWebhooks.length > 0) {
            const { data: userProfile } = await supabase
              .from("profiles")
              .select("full_name, email")
              .eq("id", payment.user_id)
              .maybeSingle();

            const webhookPayload = {
              evento: "recarga_pix",
              usuario: userProfile?.full_name || "Desconhecido",
              email: userProfile?.email || "",
              valor: `R$ ${(payment.amount_cents / 100).toFixed(2).replace(".", ",")}`,
              moedas: Number(payment.moedas),
              data: new Date().toISOString(),
            };

            for (const wh of activeWebhooks) {
              fetch(wh.url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(webhookPayload),
              }).catch((err) => console.error("Webhook error:", wh.url, err));
            }
          }
        } catch (whErr) {
          console.error("Webhook dispatch error:", whErr);
        }

        processed++;
        console.log(`✅ Payment processed: ${payment.id} | User: ${payment.user_id} | Moedas: ${payment.moedas}`);
      } catch (paymentErr) {
        console.error(`Error processing payment ${payment.id}:`, paymentErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed, total: pendingPayments.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("cron-check-pending-pix error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
