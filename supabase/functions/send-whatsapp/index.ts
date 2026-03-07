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

async function getWhatsAppPrice(supabaseAdmin: any): Promise<number> {
    const { data } = await supabaseAdmin
        .from("system_config")
        .select("value")
        .eq("key", "custo_whatsapp")
        .maybeSingle();
    return data?.value ?? 29.99;
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
            .select("id, user_id")
            .eq("id", loja_id)
            .eq("user_id", user.id)
            .maybeSingle();

        if (!loja) return jsonResp({ error: "Loja not found or not owned by user" }, 403);

        const ADMIN_TOKEN = Deno.env.get("UAZAPI_ADMIN_TOKEN")!;

        // ── INIT: Create instance (with subscription debit) ──
        if (action === "init") {
            const price = await getWhatsAppPrice(supabaseAdmin);

            const { data: debited, error: debitErr } = await supabaseAdmin.rpc("debit_user_credits", {
                _user_id: user.id,
                _quantidade: price,
                _descricao: `Assinatura WhatsApp (${price} moedas/mês)`,
            });

            if (debitErr || !debited) {
                return jsonResp({ error: "Saldo insuficiente para assinar o WhatsApp" }, 402);
            }

            const instanceName = body.instance_name || `magnus-${loja_id.slice(0, 8)}-${Date.now().toString(36)}`;

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

            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

            // Use INSERT (not upsert) to support multiple instances
            const { error: dbErr } = await supabaseAdmin
                .from("whatsapp_instances")
                .insert({
                    loja_id,
                    instance_name: instanceName,
                    instance_token: token,
                    status: "disconnected",
                    expires_at: expiresAt,
                    subscription_price: price,
                    updated_at: new Date().toISOString(),
                });

            if (dbErr) return jsonResp({ error: "DB save failed", details: dbErr.message }, 500);

            return jsonResp({ success: true, token, instance_name: instanceName, expires_at: expiresAt, price });
        }

        // ── Get instance token from DB ──
        // If instance_id is provided, use that specific instance; otherwise get any for the loja
        let instance: any = null;
        if (body.instance_id) {
            const { data } = await supabaseAdmin
                .from("whatsapp_instances")
                .select("*")
                .eq("id", body.instance_id)
                .eq("loja_id", loja_id)
                .maybeSingle();
            instance = data;
        } else {
            const { data } = await supabaseAdmin
                .from("whatsapp_instances")
                .select("*")
                .eq("loja_id", loja_id)
                .maybeSingle();
            instance = data;
        }

        if (!instance && action !== "init") {
            return jsonResp({ error: "No WhatsApp instance found. Create one first." }, 404);
        }

        const instanceToken = instance?.instance_token;

        // ── RENEW: Renew subscription ──
        if (action === "renew") {
            const price = await getWhatsAppPrice(supabaseAdmin);

            const { data: debited, error: debitErr } = await supabaseAdmin.rpc("debit_user_credits", {
                _user_id: user.id,
                _quantidade: price,
                _descricao: `Renovação WhatsApp (${price} moedas/mês)`,
            });

            if (debitErr || !debited) {
                return jsonResp({ error: "Saldo insuficiente para renovar o WhatsApp" }, 402);
            }

            const currentExpires = instance?.expires_at ? new Date(instance.expires_at) : new Date();
            const baseDate = currentExpires > new Date() ? currentExpires : new Date();
            const newExpires = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

            await supabaseAdmin
                .from("whatsapp_instances")
                .update({
                    expires_at: newExpires,
                    subscription_price: price,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", instance.id);

            return jsonResp({ success: true, expires_at: newExpires, price });
        }

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

            await supabaseAdmin
                .from("whatsapp_instances")
                .update({
                    status: "connecting",
                    qr_code: data.qrcode || data.qr_code || null,
                    pairing_code: data.pairingCode || data.pairing_code || null,
                    phone: body.phone || null,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", instance.id);

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

            await supabaseAdmin
                .from("whatsapp_instances")
                .update({
                    status: newStatus,
                    qr_code: data.qrcode || data.qr_code || instance?.qr_code || null,
                    pairing_code: data.pairingCode || data.pairing_code || instance?.pairing_code || null,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", instance.id);

            return jsonResp({
                success: true,
                status: newStatus,
                qr_code: data.qrcode || data.qr_code || null,
                pairing_code: data.pairingCode || data.pairing_code || null,
                instance_name: instance?.instance_name,
                phone: instance?.phone,
                expires_at: instance?.expires_at,
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
                .eq("id", instance.id);

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
                .eq("id", instance.id);

            return jsonResp({ success: true });
        }

        // ── Helper: check subscription expiration ──
        function checkSubscriptionExpired(): Response | null {
            if (!instance?.expires_at || new Date(instance.expires_at) < new Date()) {
                return jsonResp({ error: "Assinatura WhatsApp expirada. Renove para continuar enviando mensagens." }, 403);
            }
            return null;
        }

        // ── Helper: log message to whatsapp_message_log ──
        async function logMessage(envioId: string, instanceId: string, status: string) {
            await supabaseAdmin.from("whatsapp_message_log").insert({
                envio_id: envioId,
                loja_id,
                instance_id: instanceId,
                status,
            });
        }

        // ── SEND (with button) ──
        if (action === "send") {
            const expiredResp = checkSubscriptionExpired();
            if (expiredResp) return expiredResp;

            const { number, text, btn_text, btn_url, footer, envio_id } = body;

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

            // Log the message
            if (envio_id) {
                await logMessage(envio_id, instance.id, res.ok ? "sent" : "failed");
            }

            if (!res.ok) return jsonResp({ error: "Send failed", details: data }, 500);

            return jsonResp({ success: true, ...data });
        }

        // ── SEND-TEXT ──
        if (action === "send-text") {
            const expiredResp = checkSubscriptionExpired();
            if (expiredResp) return expiredResp;

            const { number, text, envio_id } = body;

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

            if (envio_id) {
                await logMessage(envio_id, instance.id, res.ok ? "sent" : "failed");
            }

            if (!res.ok) return jsonResp({ error: "Send failed", details: data }, 500);

            return jsonResp({ success: true, ...data });
        }

        // ── SEND-QUEUE: Bulk send with rotation ──
        if (action === "send-queue") {
            const { envio_ids, msg_template, btn_text, btn_url_template, footer } = body;

            if (!envio_ids || !Array.isArray(envio_ids) || envio_ids.length === 0) {
                return jsonResp({ error: "envio_ids array is required" }, 400);
            }

            // Get ALL active instances for this loja (connected + valid subscription)
            const { data: allInstances } = await supabaseAdmin
                .from("whatsapp_instances")
                .select("*")
                .eq("loja_id", loja_id)
                .eq("status", "connected");

            const activeInstances = (allInstances || []).filter(
                (i: any) => i.expires_at && new Date(i.expires_at) > new Date()
            );

            if (activeInstances.length === 0) {
                return jsonResp({ error: "Nenhuma instância WhatsApp ativa e conectada encontrada." }, 400);
            }

            // Get envios data
            const { data: enviosData } = await supabaseAdmin
                .from("envios")
                .select("*")
                .in("id", envio_ids);

            if (!enviosData || enviosData.length === 0) {
                return jsonResp({ error: "No envios found" }, 404);
            }

            // Get delay from postagem_config
            const { data: configData } = await supabaseAdmin
                .from("postagem_config")
                .select("whatsapp_delay_seconds")
                .eq("loja_id", loja_id)
                .maybeSingle();

            const delayMs = ((configData?.whatsapp_delay_seconds) || 300) * 1000;

            const results: { envio_id: string; status: string; instance_name: string }[] = [];

            for (let i = 0; i < enviosData.length; i++) {
                const envio = enviosData[i];
                // Round-robin rotation
                const inst = activeInstances[i % activeInstances.length];

                if (!envio.cliente_telefone) {
                    await logMessage(envio.id, inst.id, "failed");
                    results.push({ envio_id: envio.id, status: "failed", instance_name: inst.instance_name });
                    continue;
                }

                const text = msg_template || envio.produto;
                const number = envio.cliente_telefone.replace(/[\s\-\(\)\+\.]/g, "").startsWith("55")
                    ? envio.cliente_telefone.replace(/[\s\-\(\)\+\.]/g, "")
                    : "55" + envio.cliente_telefone.replace(/[\s\-\(\)\+\.]/g, "");

                const choices: string[] = [];
                if (btn_text && btn_url_template) {
                    choices.push(`${btn_text}|${btn_url_template.replace("{{codigo_rastreio}}", envio.codigo_rastreio || "")}`);
                }

                const sendBody: Record<string, unknown> = {
                    number,
                    type: "button",
                    text,
                    choices,
                };
                if (footer) sendBody.footerText = footer;

                try {
                    const res = await fetch(`${UAZAPI_BASE}/send/menu`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Accept: "application/json",
                            token: inst.instance_token,
                        },
                        body: JSON.stringify(sendBody),
                    });

                    const status = res.ok ? "sent" : "failed";
                    await logMessage(envio.id, inst.id, status);
                    results.push({ envio_id: envio.id, status, instance_name: inst.instance_name });
                } catch {
                    await logMessage(envio.id, inst.id, "failed");
                    results.push({ envio_id: envio.id, status: "failed", instance_name: inst.instance_name });
                }

                // Delay between sends (except last)
                if (i < enviosData.length - 1 && delayMs > 0) {
                    await new Promise((r) => setTimeout(r, Math.min(delayMs, 10000))); // cap at 10s for edge function
                }
            }

            return jsonResp({ success: true, results });
        }

        return jsonResp({ error: `Unknown action: ${action}` }, 400);
    } catch (error: unknown) {
        console.error("Error in send-whatsapp:", error);
        const msg = error instanceof Error ? error.message : "Unknown error";
        return jsonResp({ error: msg }, 500);
    }
});
