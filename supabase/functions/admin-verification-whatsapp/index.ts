import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const UAZAPI_BASE = "https://rushsend.uazapi.com";

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getConfigValue(supabase: any, key: string): Promise<string | null> {
  const { data } = await supabase
    .from("system_config")
    .select("text_value")
    .eq("key", key)
    .maybeSingle();
  return data?.text_value || null;
}

async function setConfig(supabase: any, key: string, textValue: string | null) {
  const { error } = await supabase
    .from("system_config")
    .upsert(
      { key, text_value: textValue, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) console.error(`Failed to upsert ${key}:`, error.message);
}

function normalizePhone(phone: unknown): string | null {
  const cleaned = String(phone ?? "").replace(/\D/g, "");
  return cleaned || null;
}

function getUazapiInstance(data: any) {
  return data?.instance || {};
}

function getUazapiStatus(data: any): string {
  const inst = getUazapiInstance(data);
  const rawStatus = inst.status || data?.state || (typeof data?.status === "string" ? data.status : null);
  const connected =
    data?.connected === true ||
    data?.loggedIn === true ||
    inst.connected === true ||
    inst.loggedIn === true ||
    data?.status?.connected === true ||
    data?.status?.loggedIn === true ||
    rawStatus === "connected" ||
    rawStatus === "open";

  if (connected) return "connected";
  if (rawStatus === "connecting" || rawStatus === "qrcode" || rawStatus === "pairing") return "connecting";
  return rawStatus || "disconnected";
}

function getUazapiPhone(data: any): string | null {
  const inst = getUazapiInstance(data);
  return normalizePhone(inst.phone || inst.owner || data?.phone || data?.owner || data?.status?.jid || data?.jid);
}

function getUazapiDisconnectReason(data: any): string | null {
  const inst = getUazapiInstance(data);
  const message = data?.message || data?.error || data?.response || data?.status?.message;
  return inst.lastDisconnectReason || data?.lastDisconnectReason || data?.status?.lastDisconnectReason || message || null;
}

function getUazapiQr(data: any): string | null {
  const inst = getUazapiInstance(data);
  return inst.qrcode || data?.qrcode || data?.qr_code || null;
}

function getUazapiPairingCode(data: any): string | null {
  const inst = getUazapiInstance(data);
  return inst.paircode || data?.pairingCode || data?.pairing_code || null;
}

async function syncUazapiState(supabase: any, data: any) {
  const status = getUazapiStatus(data);
  const phone = getUazapiPhone(data);
  const disconnectReason = getUazapiDisconnectReason(data);

  await setConfig(supabase, "verificacao_whatsapp_status", status);
  await setConfig(supabase, "verificacao_whatsapp_last_checked_at", new Date().toISOString());
  if (phone) await setConfig(supabase, "verificacao_whatsapp_phone", phone);
  if (status === "connected") {
    await setConfig(supabase, "verificacao_whatsapp_last_disconnect_reason", null);
  } else if (disconnectReason) {
    await setConfig(supabase, "verificacao_whatsapp_last_disconnect_reason", disconnectReason);
  }

  return { status, phone, disconnectReason };
}

async function parseJsonResponse(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: text };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResp({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return jsonResp({ error: "Unauthorized" }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) return jsonResp({ error: "Forbidden: admin only" }, 403);

    const body = await req.json();
    const { action } = body;
    if (!action) return jsonResp({ error: "action is required" }, 400);

    const ADMIN_TOKEN = Deno.env.get("UAZAPI_ADMIN_TOKEN")!;

    // ── INIT: Create verification instance ──
    if (action === "init") {
      // Check if instance already exists
      const existingToken = await getConfigValue(adminClient, "verificacao_whatsapp_token");
      if (existingToken) {
        return jsonResp({ error: "Instância já existe. Exclua primeiro antes de criar outra." }, 400);
      }

      const instanceName = `magnus-verificacao-${Date.now().toString(36)}`;

      const res = await fetch(`${UAZAPI_BASE}/instance/init`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          admintoken: ADMIN_TOKEN,
        },
        body: JSON.stringify({
          name: instanceName,
          systemName: "magnusfrete-verificacao",
        }),
      });

      const data = await res.json();
      console.log("UAZAPI init response:", JSON.stringify(data));

      if (!res.ok) return jsonResp({ error: "UAZAPI init failed", details: data }, 500);

      const token = data.token || data.instance?.token;
      if (!token) return jsonResp({ error: "No token in UAZAPI response", details: data }, 500);

      await setConfig(adminClient, "verificacao_whatsapp_token", token);
      await setConfig(adminClient, "verificacao_whatsapp_instance", instanceName);
      await setConfig(adminClient, "verificacao_whatsapp_status", "disconnected");
      await setConfig(adminClient, "verificacao_whatsapp_phone", null);
      await setConfig(adminClient, "verificacao_whatsapp_last_disconnect_reason", null);
      await setConfig(adminClient, "verificacao_whatsapp_last_checked_at", new Date().toISOString());

      return jsonResp({ success: true, token, instance_name: instanceName });
    }

    // Get instance token for other actions
    const instanceToken = await getConfigValue(adminClient, "verificacao_whatsapp_token");
    if (!instanceToken && action !== "init") {
      return jsonResp({ error: "Nenhuma instância configurada. Crie uma primeiro." }, 404);
    }

    // ── CONNECT: Generate QR code ──
    if (action === "connect") {
      const res = await fetch(`${UAZAPI_BASE}/instance/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          token: instanceToken!,
        },
        body: JSON.stringify({}),
      });

      const data = await parseJsonResponse(res);
      console.log("UAZAPI connect response:", JSON.stringify(data));

      const qrCode = getUazapiQr(data);
      const pairingCode = getUazapiPairingCode(data);
      const state = await syncUazapiState(adminClient, data);

      return jsonResp({ success: true, qrcode: qrCode, pairingCode, ...state });
    }

    // ── STATUS: Check connection status ──
    if (action === "status") {
      const res = await fetch(`${UAZAPI_BASE}/instance/status`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          token: instanceToken!,
        },
      });

      const data = await parseJsonResponse(res);
      const qrCode = getUazapiQr(data);
      const pairingCode = getUazapiPairingCode(data);
      const state = await syncUazapiState(adminClient, data);

      return jsonResp({ success: true, qrcode: qrCode, pairingCode, ...state });
    }

    // ── DISCONNECT ──
    if (action === "disconnect") {
      const res = await fetch(`${UAZAPI_BASE}/instance/disconnect`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          token: instanceToken!,
        },
      });

      await res.json();

      await setConfig(adminClient, "verificacao_whatsapp_status", "disconnected");
      await setConfig(adminClient, "verificacao_whatsapp_phone", null);
      await setConfig(adminClient, "verificacao_whatsapp_last_disconnect_reason", "manual_disconnect");
      await setConfig(adminClient, "verificacao_whatsapp_last_checked_at", new Date().toISOString());

      return jsonResp({ success: true });
    }

    // ── DELETE ──
    if (action === "delete") {
      await fetch(`${UAZAPI_BASE}/instance`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          token: instanceToken!,
        },
      });

      await setConfig(adminClient, "verificacao_whatsapp_token", null);
      await setConfig(adminClient, "verificacao_whatsapp_instance", null);
      await setConfig(adminClient, "verificacao_whatsapp_status", "disconnected");
      await setConfig(adminClient, "verificacao_whatsapp_phone", null);
      await setConfig(adminClient, "verificacao_whatsapp_last_disconnect_reason", null);
      await setConfig(adminClient, "verificacao_whatsapp_last_checked_at", new Date().toISOString());

      return jsonResp({ success: true });
    }

    // ── TEST: Send test message ──
    if (action === "test") {
      const testPhone = normalizePhone(body.phone);
      if (!testPhone) return jsonResp({ error: "Número de teste inválido" }, 400);

      const res = await fetch(`${UAZAPI_BASE}/send/text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          token: instanceToken!,
        },
        body: JSON.stringify({
          number: testPhone,
          text: "123456 - Mensagem de teste de verificação. Ignore.",
        }),
      });

      if (res.ok) {
        await setConfig(adminClient, "verificacao_whatsapp_status", "connected");
        await setConfig(adminClient, "verificacao_whatsapp_last_disconnect_reason", null);
        await setConfig(adminClient, "verificacao_whatsapp_last_checked_at", new Date().toISOString());
        return jsonResp({ success: true, message: "Mensagem de teste enviada!" });
      } else {
        const body = await res.text();
        if (body.toLowerCase().includes("disconnected") || body.toLowerCase().includes("not reconnectable")) {
          await setConfig(adminClient, "verificacao_whatsapp_status", "disconnected");
          await setConfig(adminClient, "verificacao_whatsapp_last_disconnect_reason", body.slice(0, 250));
          await setConfig(adminClient, "verificacao_whatsapp_last_checked_at", new Date().toISOString());
        }
        return jsonResp({ error: `Erro: ${res.status} - ${body.slice(0, 100)}` }, 500);
      }
    }

    return jsonResp({ error: "Invalid action" }, 400);
  } catch (err: unknown) {
    console.error("admin-verification-whatsapp error:", err);
    const msg = err instanceof Error ? err.message : "Internal error";
    return jsonResp({ error: msg }, 500);
  }
});
