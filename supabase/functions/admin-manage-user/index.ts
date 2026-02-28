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

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claimsData.claims.sub as string;

    // Use service role client for admin operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check caller is admin
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, target_user_id } = await req.json();

    if (!action || !target_user_id) {
      return new Response(JSON.stringify({ error: "Missing action or target_user_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent self-action
    if (target_user_id === callerId) {
      return new Response(JSON.stringify({ error: "Você não pode executar esta ação em sua própria conta." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "block") {
      // Ban user in auth
      const { error: banErr } = await adminClient.auth.admin.updateUserById(target_user_id, {
        ban_duration: "876600h", // ~100 years
      });
      if (banErr) throw banErr;

      // Mark as blocked in profiles
      const { error: profileErr } = await adminClient
        .from("profiles")
        .update({ blocked: true })
        .eq("id", target_user_id);
      if (profileErr) throw profileErr;

      return new Response(JSON.stringify({ success: true, message: "Usuário bloqueado." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "unblock") {
      // Unban user in auth
      const { error: unbanErr } = await adminClient.auth.admin.updateUserById(target_user_id, {
        ban_duration: "none",
      });
      if (unbanErr) throw unbanErr;

      // Mark as unblocked in profiles
      const { error: profileErr } = await adminClient
        .from("profiles")
        .update({ blocked: false })
        .eq("id", target_user_id);
      if (profileErr) throw profileErr;

      return new Response(JSON.stringify({ success: true, message: "Usuário desbloqueado." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      // Clean up related data that doesn't cascade from auth.users
      // Get user's lojas
      const { data: lojas } = await adminClient
        .from("lojas")
        .select("id")
        .eq("user_id", target_user_id);

      const lojaIds = (lojas || []).map((l) => l.id);

      if (lojaIds.length > 0) {
        // Delete related data by loja
        await adminClient.from("envios").delete().in("loja_id", lojaIds);
        await adminClient.from("pedidos").delete().in("loja_id", lojaIds);
        await adminClient.from("leads").delete().in("loja_id", lojaIds);
        await adminClient.from("postagem_email_log").delete().in("loja_id", lojaIds);
        await adminClient.from("postagem_config").delete().in("loja_id", lojaIds);
        await adminClient.from("checkout_integrations").delete().in("loja_id", lojaIds);
        await adminClient.from("shopify_integrations").delete().in("loja_id", lojaIds);
        await adminClient.from("webhook_logs").delete().in("loja_id", lojaIds);
        await adminClient.from("empresas").delete().in("loja_id", lojaIds);

        // Delete custom templates and their events
        const { data: templates } = await adminClient
          .from("postagem_templates")
          .select("id")
          .in("loja_id", lojaIds);
        const templateIds = (templates || []).map((t) => t.id);
        if (templateIds.length > 0) {
          await adminClient.from("postagem_eventos").delete().in("template_id", templateIds);
          await adminClient.from("postagem_templates").delete().in("id", templateIds);
        }

        // Delete lojas
        await adminClient.from("lojas").delete().eq("user_id", target_user_id);
      }

      // Delete pix_payments
      await adminClient.from("pix_payments").delete().eq("user_id", target_user_id);

      // Delete credits & transactions
      await adminClient.from("creditos_transacoes").delete().eq("user_id", target_user_id);
      await adminClient.from("creditos").delete().eq("user_id", target_user_id);

      // Delete roles & profile
      await adminClient.from("user_roles").delete().eq("user_id", target_user_id);
      await adminClient.from("profiles").delete().eq("id", target_user_id);

      // Finally delete the auth user
      const { error: deleteErr } = await adminClient.auth.admin.deleteUser(target_user_id);
      if (deleteErr) throw deleteErr;

      return new Response(JSON.stringify({ success: true, message: "Usuário excluído permanentemente." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("admin-manage-user error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
