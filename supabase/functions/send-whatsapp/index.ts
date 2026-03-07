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

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) return jsonResp({ error: "Not authenticated" }, 401);

        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // Verify user from JWT
        const supabaseUser = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_ANON_KEY")!,
            { global: { headers: { Authorization: authHeader } } }
        );
        const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
        if (userErr || !user) return jsonResp({ error: "Invalid token" }, 401);

        const body = await req.json();
        const { action, loja_id } = body;

        if (!action || !loja_id) {
            return jsonResp({ error: "action and loja_id are required" }, 400);
        }

        // Verify user owns the loja
        const { data: loja } = await supabaseAdmin
            .from("lojas")
            .select("id")
            .eq("id", loja_id)
            .eq("user_id", user.id)
            .maybeSingle();

        if (!loja) return jsonResp({ error: "Loja not found or not owned by user" }, 403);

        const ADMIN_TOKEN = Deno.env.get("UAZAPI_ADMIN_TOKEN")!;

        // ── INIT: Create instance ──
        if (action === "init") {
            const instanceName = body.instance_name || `magnus-${loja_id.slice(0, 8)}`;

            const res = await fetch(`${UAZAPI_BASE}/instance/init`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    admintoken: ADMIN_TOKEN,
                },
                body: JSON.stringify({
                    name: instanceName,
                    systemName: "magnusfrete",
                }),
            });

            const data = await res.json();
            console.log("UAZAPI init response:", JSON.stringify(data));

            if (!res.ok) return jsonResp({ error: "UAZAPI init failed", details: data }, 500);

            const token = data.token || data.instance?.token;
            if (!token) return jsonResp({ error: "No token in UAZAPI response", details: data }, 500);

            // Save to DB
            const { error: dbErr } = await supabaseAdmin
                .from("whatsapp_instances")
                .upsert(
                    {
                        loja_id,
                        instance_name: instanceName,
                        instance_token: token,
                        status: "disconnected",
                        updated_at: new Date().toISOString(),
                    },
                    { onConflict: "loja_id" }
                );

            if (dbErr) return jsonResp({ error: "DB save failed", details: dbErr.message }, 500);

            return jsonResp({ success: true, token, instance_name: instanceName });
        }

        // ── Get instance token from DB ──
        const { data: instance } = await supabaseAdmin
            .from("whatsapp_instances")
            .select("*")
            .eq("loja_id", loja_id)
            .maybeSingle();

        if (!instance && action !== "init") {
            return jsonResp({ error: "No WhatsApp instance found. Create one first." }, 404);
        }

        const instanceToken = instance?.instance_token;

        // ── CONNECT ──
        if (action === "connect") {
            const connectBody: Record<string, string> = {};
            if (body.phone) connectBody.phone = body.phone;

            const res = await fetch(`${UAZAPI_BASE}/instance/connect`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    token: instanceToken,
                },
                body: JSON.stringify(connectBody),
            });

            const data = await res.json();
            console.log("UAZAPI connect response:", JSON.stringify(data));

            // Update status in DB
            await supabaseAdmin
                .from("whatsapp_instances")
                .update({
                    status: "connecting",
                    qr_code: data.qrcode || data.qr_code || null,
                    pairing_code: data.pairingCode || data.pairing_code || null,
                    phone: body.phone || null,
                    updated_at: new Date().toISOString(),
                })
                .eq("loja_id", loja_id);

            return jsonResp({ success: true, ...data });
        }

        // ── STATUS ──
        if (action === "status") {
            const res = await fetch(`${UAZAPI_BASE}/instance/status`, {
                method: "GET",
                headers: {
                    Accept: "application/json",
                    token: instanceToken,
                },
            });

            const data = await res.json();

            const newStatus = data.status || data.state || "disconnected";

            // Update DB with latest status
            await supabaseAdmin
                .from("whatsapp_instances")
                .update({
                    status: newStatus,
                    qr_code: data.qrcode || data.qr_code || instance?.qr_code || null,
                    pairing_code: data.pairingCode || data.pairing_code || instance?.pairing_code || null,
                    updated_at: new Date().toISOString(),
                })
                .eq("loja_id", loja_id);

            return jsonResp({
                success: true,
                status: newStatus,
                qr_code: data.qrcode || data.qr_code || null,
                pairing_code: data.pairingCode || data.pairing_code || null,
                instance_name: instance?.instance_name,
                phone: instance?.phone,
                ...data,
            });
        }

        // ── DISCONNECT ──
        if (action === "disconnect") {
            const res = await fetch(`${UAZAPI_BASE}/instance/disconnect`, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    token: instanceToken,
                },
            });

            await res.json();

            await supabaseAdmin
                .from("whatsapp_instances")
                .update({
                    status: "disconnected",
                    qr_code: null,
                    pairing_code: null,
                    updated_at: new Date().toISOString(),
                })
                .eq("loja_id", loja_id);

            return jsonResp({ success: true });
        }

        // ── DELETE ──
        if (action === "delete") {
            await fetch(`${UAZAPI_BASE}/instance`, {
                method: "DELETE",
                headers: {
                    Accept: "application/json",
                    token: instanceToken,
                },
            });

            await supabaseAdmin
                .from("whatsapp_instances")
                .delete()
                .eq("loja_id", loja_id);

            return jsonResp({ success: true });
        }

        // ── SEND (with button) ──
        if (action === "send") {
            const { number, text, btn_text, btn_url, footer } = body;

            if (!number || !text) {
                return jsonResp({ error: "number and text are required" }, 400);
            }

            const choices: string[] = [];
            if (btn_text && btn_url) {
                choices.push(`${btn_text}|${btn_url}`);
            }

            const sendBody: Record<string, unknown> = {
                number,
                type: "button",
                text,
                choices,
            };

            if (footer) sendBody.footerText = footer;

            const res = await fetch(`${UAZAPI_BASE}/send/menu`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    token: instanceToken,
                },
                body: JSON.stringify(sendBody),
            });

            const data = await res.json();
            console.log("UAZAPI send response:", JSON.stringify(data));

            if (!res.ok) return jsonResp({ error: "Send failed", details: data }, 500);

            return jsonResp({ success: true, ...data });
        }

        // ── SEND-TEXT ──
        if (action === "send-text") {
            const { number, text } = body;

            if (!number || !text) {
                return jsonResp({ error: "number and text are required" }, 400);
            }

            const res = await fetch(`${UAZAPI_BASE}/send/text`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    token: instanceToken,
                },
                body: JSON.stringify({ number, text }),
            });

            const data = await res.json();

            if (!res.ok) return jsonResp({ error: "Send failed", details: data }, 500);

            return jsonResp({ success: true, ...data });
        }

        return jsonResp({ error: `Unknown action: ${action}` }, 400);
    } catch (error: unknown) {
        console.error("Error in send-whatsapp:", error);
        const msg = error instanceof Error ? error.message : "Unknown error";
        return jsonResp({ error: msg }, 500);
    }
});
