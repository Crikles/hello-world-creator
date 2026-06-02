// Backup incremental para Google Drive via Connector Gateway
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";
const ROOT_FOLDER_NAME = "LovableCloud-Backup";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const GOOGLE_DRIVE_API_KEY = Deno.env.get("GOOGLE_DRIVE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

// table_name -> cursor column (NULL = full snapshot every run)
const TABLES: Record<string, string | null> = {
  admin_cashback_processed: "created_at",
  admin_payment_webhooks: "created_at",
  batch_progress: "updated_at",
  cashback_log: "created_at",
  checkout_integrations: "updated_at",
  confirmacao_pagamento_config: "updated_at",
  confirmacao_pagamento_log: "created_at",
  creditos: "updated_at",
  creditos_transacoes: "created_at",
  debit_blocks: "created_at",
  empresas: "updated_at",
  envios: "updated_at",
  leads: "created_at",
  live_view_pings: "created_at",
  lojas: "updated_at",
  pedidos: "updated_at",
  pix_payments: "created_at",
  postagem_config: "updated_at",
  postagem_email_log: "updated_at",
  postagem_eventos: "created_at",
  postagem_templates: "updated_at",
  profiles: "created_at",
  push_notification_log: "created_at",
  push_notification_settings: "updated_at",
  push_subscriptions: "created_at",
  push_templates: "updated_at",
  recovery_config: "updated_at",
  recovery_leads: "updated_at",
  retry_execucoes: "updated_at",
  shopify_integrations: "updated_at",
  signup_verifications: "created_at",
  sms_templates: "updated_at",
  system_config: "updated_at",
  upsell_config: "updated_at",
  user_roles: null,
  webhook_logs: "created_at",
  whatsapp_instances: "updated_at",
  whatsapp_message_log: "created_at",
  whatsapp_send_queue: "updated_at",
  whatsapp_subscriptions: "created_at",
};

async function driveFetch(path: string, init: RequestInit = {}) {
  const url = path.startsWith("http") ? path : `${GATEWAY}${path}`;
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${LOVABLE_API_KEY}`);
  headers.set("X-Connection-Api-Key", GOOGLE_DRIVE_API_KEY);
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive ${res.status}: ${body.slice(0, 500)}`);
  }
  return res;
}

async function findOrCreateFolder(name: string, parentId?: string): Promise<string> {
  const parentQ = parentId ? ` and '${parentId}' in parents` : "";
  const q = encodeURIComponent(
    `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentQ}`,
  );
  const res = await driveFetch(`/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`);
  const json = await res.json();
  if (json.files?.length) return json.files[0].id;

  const meta: Record<string, unknown> = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) meta.parents = [parentId];

  const created = await driveFetch(`/drive/v3/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(meta),
  });
  const cj = await created.json();
  return cj.id;
}

async function uploadJson(folderId: string, name: string, content: string): Promise<number> {
  const meta = { name, parents: [folderId], mimeType: "application/json" };
  const boundary = "----lovable" + crypto.randomUUID();
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(meta) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
    content +
    `\r\n--${boundary}--`;

  await driveFetch(
    `https://connector-gateway.lovable.dev/google_drive/upload/drive/v3/files?uploadType=multipart`,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  return new TextEncoder().encode(content).length;
}

async function backupTable(
  table: string,
  cursorCol: string | null,
  since: string,
  folderId: string,
) {
  const PAGE = 1000;
  let from = 0;
  const all: unknown[] = [];

  while (true) {
    let q = admin.from(table).select("*").range(from, from + PAGE - 1);
    if (cursorCol) q = q.gt(cursorCol, since).order(cursorCol, { ascending: true });
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
    if (all.length > 200_000) break; // safety
  }

  if (all.length === 0) return { rows: 0, bytes: 0 };

  const content = JSON.stringify(all);
  const bytes = await uploadJson(folderId, `${table}.json`, content);
  return { rows: all.length, bytes };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // AuthZ: admin only (manual) or service role (cron via pg_net using anon → require admin)
  let isCron = false;
  try {
    const body = req.method === "POST" ? await req.clone().json().catch(() => ({})) : {};
    isCron = body?.source === "cron";
  } catch (_) { /* ignore */ }

  if (!isCron) {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Apenas admins" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const { data: runRow } = await admin
    .from("backup_runs")
    .insert({ status: "running" })
    .select()
    .single();
  const runId = runRow!.id;

  let totalRows = 0;
  let totalBytes = 0;
  let processed = 0;
  const details: Record<string, unknown> = {};

  try {
    const rootId = await findOrCreateFolder(ROOT_FOLDER_NAME);
    const dateFolder = new Date().toISOString().slice(0, 10);
    const dayId = await findOrCreateFolder(dateFolder, rootId);

    await admin.from("backup_runs").update({ drive_folder_id: dayId }).eq("id", runId);

    const { data: states } = await admin.from("backup_state").select("*");
    const stateMap = new Map((states ?? []).map((s: any) => [s.table_name, s]));

    for (const [table, cursor] of Object.entries(TABLES)) {
      const st: any = stateMap.get(table);
      const since = cursor ? (st?.last_backup_at ?? "1970-01-01T00:00:00Z") : "1970-01-01T00:00:00Z";
      const runStart = new Date().toISOString();
      try {
        const { rows, bytes } = await backupTable(table, cursor, since, dayId);
        totalRows += rows;
        totalBytes += bytes;
        processed += 1;
        details[table] = { rows, bytes };
        await admin.from("backup_state").upsert({
          table_name: table,
          last_backup_at: runStart,
          last_run_at: runStart,
          last_rows_count: rows,
          last_status: "ok",
          last_error: null,
          updated_at: runStart,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        details[table] = { error: msg };
        await admin.from("backup_state").upsert({
          table_name: table,
          last_backup_at: st?.last_backup_at ?? "1970-01-01T00:00:00Z",
          last_run_at: runStart,
          last_rows_count: 0,
          last_status: "error",
          last_error: msg,
          updated_at: runStart,
        });
      }
    }

    await admin.from("backup_runs").update({
      finished_at: new Date().toISOString(),
      status: "ok",
      tables_processed: processed,
      total_rows: totalRows,
      total_bytes: totalBytes,
      details,
    }).eq("id", runId);

    return new Response(
      JSON.stringify({ ok: true, runId, totalRows, totalBytes, processed, folder: dateFolder }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await admin.from("backup_runs").update({
      finished_at: new Date().toISOString(),
      status: "error",
      error: msg,
      details,
    }).eq("id", runId);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
