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

        // ── Helper: find a free subscription slot (active sub with no linked instance) ──
        async function findFreeSlot(): Promise<any | null> {
            // Get all active subscriptions for this loja
            const { data: subs } = await supabaseAdmin
                .from("whatsapp_subscriptions")
                .select("id, expires_at, price_paid")
                .eq("loja_id", loja_id)
                .gt("expires_at", new Date().toISOString());

            if (!subs || subs.length === 0) return null;

            // Get all instances that have a subscription_id
            const { data: usedInstances } = await supabaseAdmin
                .from("whatsapp_instances")
                .select("subscription_id")
                .eq("loja_id", loja_id)
                .not("subscription_id", "is", null);

            const usedSubIds = new Set((usedInstances || []).map((i: any) => i.subscription_id));

            // Find first sub not linked to any instance
            return subs.find((s: any) => !usedSubIds.has(s.id)) || null;
        }

        // ── INIT: Create instance (with slot-based subscription) ──
        if (action === "init") {
            // Check for a free slot first
            const freeSlot = await findFreeSlot();
            let subscriptionId: string;
            let expiresAt: string;
            let price: number;

            if (freeSlot) {
                // Use existing slot — no charge
                subscriptionId = freeSlot.id;
                expiresAt = freeSlot.expires_at;
                price = 0;
            } else {
                // No free slot — charge credits and create new subscription
                price = await getWhatsAppPrice(supabaseAdmin);

                const { data: debited, error: debitErr } = await supabaseAdmin.rpc("debit_user_credits", {
                    _user_id: user.id,
                    _quantidade: price,
                    _descricao: `Assinatura WhatsApp (${price} moedas/mês)`,
                });

                if (debitErr || !debited) {
                    return jsonResp({ error: "Saldo insuficiente para assinar o WhatsApp" }, 402);
                }

                expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

                // Create subscription record
                const { data: newSub, error: subErr } = await supabaseAdmin
                    .from("whatsapp_subscriptions")
                    .insert({
                        loja_id,
                        user_id: user.id,
                        expires_at: expiresAt,
                        price_paid: price,
                    })
                    .select("id")
                    .single();

                if (subErr || !newSub) {
                    return jsonResp({ error: "Failed to create subscription", details: subErr?.message }, 500);
                }

                subscriptionId = newSub.id;
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

            const { error: dbErr } = await supabaseAdmin
                .from("whatsapp_instances")
                .insert({
                    loja_id,
                    instance_name: instanceName,
                    instance_token: token,
                    status: "disconnected",
                    expires_at: expiresAt,
                    subscription_price: price || (await getWhatsAppPrice(supabaseAdmin)),
                    subscription_id: subscriptionId,
                    updated_at: new Date().toISOString(),
                });

            if (dbErr) return jsonResp({ error: "DB save failed", details: dbErr.message }, 500);

            return jsonResp({
                success: true,
                token,
                instance_name: instanceName,
                expires_at: expiresAt,
                price,
                used_free_slot: !!freeSlot,
            });
        }

        // ── Get instance token from DB ──
        let instance: any = null;
        if (body.instance_id) {
            const { data } = await supabaseAdmin
                .from("whatsapp_instances")
                .select("*")
                .eq("id", body.instance_id)
                .eq("loja_id", loja_id)
                .maybeSingle();
            instance = data;
        } else if (action !== "list-subscriptions") {
            // For actions that don't specify instance_id, pick the first one
            const { data } = await supabaseAdmin
                .from("whatsapp_instances")
                .select("*")
                .eq("loja_id", loja_id)
                .order("created_at", { ascending: true })
                .limit(1);
            instance = data?.[0] || null;
        }

        if (!instance && action !== "init" && action !== "list-subscriptions") {
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

            // Renew or create subscription
            if (instance.subscription_id) {
                // Get current subscription
                const { data: sub } = await supabaseAdmin
                    .from("whatsapp_subscriptions")
                    .select("expires_at")
                    .eq("id", instance.subscription_id)
                    .maybeSingle();

                const currentExpires = sub?.expires_at ? new Date(sub.expires_at) : new Date();
                const baseDate = currentExpires > new Date() ? currentExpires : new Date();
                const newExpires = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

                await supabaseAdmin
                    .from("whatsapp_subscriptions")
                    .update({ expires_at: newExpires })
                    .eq("id", instance.subscription_id);

                await supabaseAdmin
                    .from("whatsapp_instances")
                    .update({
                        expires_at: newExpires,
                        subscription_price: price,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", instance.id);

                return jsonResp({ success: true, expires_at: newExpires, price });
            } else {
                // Legacy instance without subscription — create one
                const currentExpires = instance?.expires_at ? new Date(instance.expires_at) : new Date();
                const baseDate = currentExpires > new Date() ? currentExpires : new Date();
                const newExpires = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

                const { data: newSub } = await supabaseAdmin
                    .from("whatsapp_subscriptions")
                    .insert({
                        loja_id,
                        user_id: user.id,
                        expires_at: newExpires,
                        price_paid: price,
                    })
                    .select("id")
                    .single();

                await supabaseAdmin
                    .from("whatsapp_instances")
                    .update({
                        expires_at: newExpires,
                        subscription_price: price,
                        subscription_id: newSub?.id || null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", instance.id);

                return jsonResp({ success: true, expires_at: newExpires, price });
            }
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
            // Delete from UAZAPI
            await fetch(`${UAZAPI_BASE}/instance`, {
                method: "DELETE",
                headers: {
                    Accept: "application/json",
                    token: instanceToken,
                },
            });

            // Delete instance row — subscription stays intact
            await supabaseAdmin
                .from("whatsapp_instances")
                .delete()
                .eq("id", instance.id);

            return jsonResp({ success: true });
        }

        // ── LIST-SUBSCRIPTIONS: Get subscriptions and free slots ──
        if (action === "list-subscriptions") {
            const { data: subs } = await supabaseAdmin
                .from("whatsapp_subscriptions")
                .select("*")
                .eq("loja_id", loja_id)
                .order("created_at", { ascending: true });

            const { data: insts } = await supabaseAdmin
                .from("whatsapp_instances")
                .select("subscription_id")
                .eq("loja_id", loja_id)
                .not("subscription_id", "is", null);

            const usedSubIds = new Set((insts || []).map((i: any) => i.subscription_id));

            const subsWithStatus = (subs || []).map((s: any) => ({
                ...s,
                is_active: new Date(s.expires_at) > new Date(),
                is_free: !usedSubIds.has(s.id) && new Date(s.expires_at) > new Date(),
            }));

            return jsonResp({
                success: true,
                subscriptions: subsWithStatus,
                total_active: subsWithStatus.filter((s: any) => s.is_active).length,
                free_slots: subsWithStatus.filter((s: any) => s.is_free).length,
            });
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

        // ── SEND (with button + optional image + reply) ──
        if (action === "send") {
            const expiredResp = checkSubscriptionExpired();
            if (expiredResp) return expiredResp;

            const { number, text, btn_text, btn_url, footer, envio_id, image_url, reply_text } = body;

            if (!number || !text) {
                return jsonResp({ error: "number and text are required" }, 400);
            }

            if (image_url) {
                try {
                    await fetch(`${UAZAPI_BASE}/send/image`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Accept: "application/json",
                            token: instanceToken,
                        },
                        body: JSON.stringify({ number, url: image_url, caption: "" }),
                    });
                } catch (e) {
                    console.error("Image send error:", e);
                }
            }

            const choices: string[] = [];
            if (btn_text && btn_url) {
                choices.push(`${btn_text}|${btn_url}`);
            }

            const buttons: string[] = [];
            if (reply_text) {
                buttons.push(reply_text);
            }

            const sendBody: Record<string, unknown> = {
                number,
                type: "button",
                text,
                choices,
            };

            if (buttons.length > 0) sendBody.buttons = buttons;
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

            const { data: enviosData } = await supabaseAdmin
                .from("envios")
                .select("*")
                .in("id", envio_ids);

            if (!enviosData || enviosData.length === 0) {
                return jsonResp({ error: "No envios found" }, 404);
            }

            const { data: configData } = await supabaseAdmin
                .from("postagem_config")
                .select("whatsapp_delay_seconds")
                .eq("loja_id", loja_id)
                .maybeSingle();

            const delayMs = ((configData?.whatsapp_delay_seconds) || 300) * 1000;

            const results: { envio_id: string; status: string; instance_name: string }[] = [];

            for (let i = 0; i < enviosData.length; i++) {
                const envio = enviosData[i];
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

                if (i < enviosData.length - 1 && delayMs > 0) {
                    await new Promise((r) => setTimeout(r, Math.min(delayMs, 10000)));
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
