import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const shop = url.searchParams.get("shop");
    const state = url.searchParams.get("state"); // This is our loja_id
    const errorMsg = url.searchParams.get("error");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const redirectUrl = `${Deno.env.get("FRONTEND_URL") || "https://sua-url.vercel.app"}/integracoes`;

    if (errorMsg || !code || !shop || !state) {
      console.error("Missing/Error Params:", { code, shop, state, errorMsg });
      return Response.redirect(`${redirectUrl}?error=auth_failed`);
    }

    // Get the client_secret from DB since we need it to exchange the code
    const { data: config, error: configError } = await supabase
      .from("shopify_integrations")
      .select("*")
      .eq("loja_id", state)
      .single();

    if (configError || !config) {
      console.error("Integration not found for loja_id:", state);
      return Response.redirect(`${redirectUrl}?error=not_found`);
    }

    // Exchange the code for an access token
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: config.client_id,
        client_secret: config.client_secret,
        code: code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Shopify Token Error:", tokenData);
      return Response.redirect(`${redirectUrl}?error=token_exchange_failed`);
    }

    // Save the access token
    const { error: updateError } = await supabase
      .from("shopify_integrations")
      .update({
        access_token: tokenData.access_token,
        updated_at: new Date().toISOString()
      })
      .eq("id", config.id);

    if (updateError) {
      console.error("DB Update Error:", updateError);
      return Response.redirect(`${redirectUrl}?error=db_update_failed`);
    }

    return Response.redirect(`${redirectUrl}?success=shopify_connected`);
  } catch (error: any) {
    console.error("Callback Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
