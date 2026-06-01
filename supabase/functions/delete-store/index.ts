import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 200;

const lojaTables = [
  "batch_progress",
  "cashback_log",
  "checkout_integrations",
  "confirmacao_pagamento_config",
  "confirmacao_pagamento_log",
  "live_view_pings",
  "postagem_config",
  "postagem_email_log",
  "recovery_config",
  "recovery_leads",
  "retry_execucoes",
  "shopify_integrations",
  "upsell_config",
  "webhook_logs",
  "whatsapp_message_log",
  "whatsapp_send_queue",
  "whatsapp_subscriptions",
  "whatsapp_instances",
  "leads",
  "pedidos",
  "envios",
  "empresas",
] as const;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function isAdmin(client: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (error) throw new Error(`Falha ao validar permissão: ${error.message}`);
  return !!data;
}

async function deleteByColumnInBatches(
  client: ReturnType<typeof createClient>,
  table: string,
  column: string,
  value: string,
  batchSize = BATCH_SIZE,
) {
  let deleted = 0;

  while (true) {
    const { data, error } = await client
      .from(table)
      .select("id")
      .eq(column, value)
      .order("id", { ascending: true })
      .limit(batchSize);

    if (error) throw new Error(`Falha ao listar ${table}: ${error.message}`);
    if (!data?.length) break;

    const ids = data.map((row) => row.id);
    const { error: deleteError } = await client.from(table).delete().in("id", ids);

    if (deleteError) throw new Error(`Falha ao excluir ${table}: ${deleteError.message}`);

    deleted += ids.length;

    if (ids.length < batchSize) break;
  }

  return deleted;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { loja_id } = await req.json();

    if (!loja_id) {
      return jsonResponse({ error: "loja_id é obrigatório" }, 400);
    }

    const { data: loja, error: lojaError } = await adminClient
      .from("lojas")
      .select("id, user_id, nome")
      .eq("id", loja_id)
      .maybeSingle();

    if (lojaError) throw new Error(`Falha ao localizar loja: ${lojaError.message}`);
    if (!loja) return jsonResponse({ error: "Loja não encontrada" }, 404);

    const callerIsAdmin = await isAdmin(adminClient, user.id);
    const callerOwnsStore = loja.user_id === user.id;

    if (!callerIsAdmin && !callerOwnsStore) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const result: Record<string, number> = {};

    const { data: templates, error: templatesError } = await adminClient
      .from("postagem_templates")
      .select("id")
      .eq("loja_id", loja_id)
      .order("id", { ascending: true });

    if (templatesError) throw new Error(`Falha ao listar postagem_templates: ${templatesError.message}`);

    for (const table of lojaTables) {
      result[table] = await deleteByColumnInBatches(adminClient, table, "loja_id", loja_id);
    }

    let deletedTemplateEvents = 0;
    for (const template of templates ?? []) {
      deletedTemplateEvents += await deleteByColumnInBatches(
        adminClient,
        "postagem_eventos",
        "template_id",
        template.id,
      );
    }
    result.postagem_eventos = deletedTemplateEvents;

    result.postagem_templates = await deleteByColumnInBatches(adminClient, "postagem_templates", "loja_id", loja_id);

    const { error: lojaDeleteError } = await adminClient.from("lojas").delete().eq("id", loja_id);
    if (lojaDeleteError) throw new Error(`Falha ao excluir loja: ${lojaDeleteError.message}`);

    result.lojas = 1;

    return jsonResponse({
      success: true,
      loja_id,
      loja_nome: loja.nome,
      deleted: result,
    });
  } catch (error) {
    console.error("delete-store error:", error);
    const message = error instanceof Error ? error.message : "Internal error";
    return jsonResponse({ error: message }, 500);
  }
});