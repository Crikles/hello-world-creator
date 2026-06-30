import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { subscription, codigoRastreio } = await req.json();

        if (!subscription || !subscription.endpoint || !subscription.keys) {
            return new Response(
                JSON.stringify({ error: "Invalid subscription object" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }
        // Validate endpoint host to prevent SSRF / abusive subscriptions
        const ep = String(subscription.endpoint);
        const allowed = /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|.*\.notify\.windows\.com|.*\.push\.apple\.com)\//.test(ep);
        if (!allowed) {
            return new Response(
                JSON.stringify({ error: "Endpoint not allowed" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }
        // Validate code format if present
        if (codigoRastreio && !/^[A-Z0-9]{6,30}$/.test(String(codigoRastreio))) {
            return new Response(
                JSON.stringify({ error: "Invalid tracking code" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, serviceRoleKey);

        const { error } = await supabase.from("push_subscriptions").upsert(
            {
                endpoint: subscription.endpoint,
                keys_p256dh: subscription.keys.p256dh,
                keys_auth: subscription.keys.auth,
                codigo_rastreio: codigoRastreio || null,
            },
            { onConflict: "endpoint" }
        );

        if (error) throw error;

        return new Response(
            JSON.stringify({ success: true }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return new Response(
            JSON.stringify({ error: msg }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
