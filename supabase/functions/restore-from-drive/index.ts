// Restauração completa a partir do Google Drive (LovableCloud-Backup)
// Lê todas as pastas diárias, consolida cada tabela mantendo a versão mais recente
// por id (último arquivo vence) e faz upsert no banco.
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

// Ordem de restauração (pais primeiro). Tabelas não-listadas são processadas no fim.
const RESTORE_ORDER = [
  "profiles",
  "user_roles",
  "creditos",
  "lojas",
  "empresas",
  "postagem_templates",
  "postagem_eventos",
  "postagem_config",
  "checkout_integrations",
  "shopify_integrations",
  "confirmacao_pagamento_config",
  "recovery_config",
  "upsell_config",
  "sms_templates",
  "push_templates",
  "push_notification_settings",
  "system_config",
  "admin_payment_webhooks",
  "envios",
  "pedidos",
  "leads",
  "recovery_leads",
  "creditos_transacoes",
  "cashback_log",
  "admin_cashback_processed",
  "confirmacao_pagamento_log",
  "postagem_email_log",
  "push_notification_log",
  "push_subscriptions",
  "pix_payments",
  "live_view_pings",
  "webhook_logs",
  "retry_execucoes",
  "batch_progress",
  "debit_blocks",
  "signup_verifications",
];

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

async function findFolder(name: string, parentId?: string): Promise<string | null> {
  const parentQ = parentId ? ` and '${parentId}' in parents` : "";
  const q = encodeURIComponent(
    `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentQ}`,
  );
  const res = await driveFetch(`/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`);
  const json = await res.json();
  return json.files?.[0]?.id ?? null;
}

async function listChildren(parentId: string, mimeType?: string) {
  const out: { id: string; name: string; mimeType: string; modifiedTime: string }[] = [];
  let pageToken: string | undefined;
  do {
    const mq = mimeType ? ` and mimeType='${mimeType}'` : "";
    const q = encodeURIComponent(`'${parentId}' in parents and trashed=false${mq}`);
    const url =
      `/drive/v3/files?q=${q}&fields=files(id,name,mimeType,modifiedTime),nextPageToken&pageSize=1000` +
      (pageToken ? `&pageToken=${pageToken}` : "");
    const res = await driveFetch(url);
    const json = await res.json();
    out.push(...(json.files ?? []));
    pageToken = json.nextPageToken;
  } while (pageToken);
  return out;
}

async function downloadJson(fileId: string): Promise<any[]> {
  const res = await driveFetch(`/drive/v3/files/${fileId}?alt=media`);
  const text = await res.text();
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function upsertBatch(table: string, rows: any[]) {
  if (rows.length === 0) return 0;
  let inserted = 0;
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await admin.from(table).upsert(slice, { onConflict: "id" });
    if (error) throw new Error(`${table}: ${error.message}`);
    inserted += slice.length;
  }
  return inserted;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // AuthZ: admin only
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Não autenticado" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Não autenticado" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: isAdmin } = await admin.rpc("has_role", {
    _user_id: user.id, _role: "admin",
  });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Apenas admins" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const folderName: string | undefined = body?.folder; // "YYYY-MM-DD" opcional; default = consolidar tudo
  const confirm: string = body?.confirm ?? "";
  if (confirm !== "RESTAURAR") {
    return new Response(
      JSON.stringify({ error: 'Envie { confirm: "RESTAURAR" } para executar.' }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const { data: runRow } = await admin
    .from("restore_runs")
    .insert({ status: "running", mode: folderName ? "single-folder" : "latest", source_folder: folderName ?? "ALL" })
    .select()
    .single();
  const runId = runRow!.id;

  const details: Record<string, any> = {};
  let totalRows = 0;
  let processed = 0;

  try {
    const rootId = await findFolder(ROOT_FOLDER_NAME);
    if (!rootId) throw new Error(`Pasta '${ROOT_FOLDER_NAME}' não encontrada no Drive.`);

    // Coleta pastas de data a processar
    const dayFolders = folderName
      ? await (async () => {
          const id = await findFolder(folderName, rootId);
          if (!id) throw new Error(`Pasta '${folderName}' não encontrada.`);
          return [{ id, name: folderName }];
        })()
      : (await listChildren(rootId, "application/vnd.google-apps.folder"))
          .sort((a, b) => a.name.localeCompare(b.name)); // ordem cronológica → versão mais recente vence

    // Consolida: tabela -> Map<id, row>
    const consolidated = new Map<string, Map<string, any>>();

    for (const day of dayFolders) {
      const files = await listChildren(day.id, "application/json");
      for (const f of files) {
        const table = f.name.replace(/\.json$/i, "");
        const rows = await downloadJson(f.id);
        if (!consolidated.has(table)) consolidated.set(table, new Map());
        const map = consolidated.get(table)!;
        for (const r of rows) {
          if (r && typeof r === "object" && "id" in r) {
            map.set(String(r.id), r);
          }
        }
      }
    }

    // Ordena tabelas por prioridade
    const allTables = Array.from(consolidated.keys());
    const ordered = [
      ...RESTORE_ORDER.filter((t) => consolidated.has(t)),
      ...allTables.filter((t) => !RESTORE_ORDER.includes(t)),
    ];

    for (const table of ordered) {
      const rows = Array.from(consolidated.get(table)!.values());
      try {
        const n = await upsertBatch(table, rows);
        details[table] = { rows: n };
        totalRows += n;
        processed += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        details[table] = { error: msg, attempted: rows.length };
      }
    }

    await admin.from("restore_runs").update({
      finished_at: new Date().toISOString(),
      status: "ok",
      tables_processed: processed,
      total_rows: totalRows,
      details,
    }).eq("id", runId);

    return new Response(
      JSON.stringify({ ok: true, runId, totalRows, tablesProcessed: processed, details }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await admin.from("restore_runs").update({
      finished_at: new Date().toISOString(),
      status: "error",
      error: msg,
      details,
    }).eq("id", runId);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
