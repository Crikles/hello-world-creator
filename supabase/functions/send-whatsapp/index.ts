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

async function getWhatsAppPrice(supabaseAdmin: any, userId?: string): Promise<number> {
    // 1. Check user custom price
    if (userId) {
        const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("custom_prices")
            .eq("id", userId)
            .maybeSingle();
        const custom = profile?.custom_prices as Record<string, number> | null;
        if (custom && custom.custo_whatsapp != null) {
            return custom.custo_whatsapp;
        }
    }
    // 2. Fallback to global
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

        // Get user via getUser for reliable auth
        const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
        if (userErr || !user) return jsonResp({ error: "Invalid token" }, 401);
        const userId = user.id;

        const body = await req.json();
        const { action, loja_id } = body;

        if (!action || !loja_id) {
            return jsonResp({ error: "action and loja_id are required" }, 400);
        }

        // Verify user owns the loja using RLS-aware client
        const { data: loja } = await supabaseUser
            .from("lojas")
            .select("id, user_id")
            .eq("id", loja_id)
            .maybeSingle();

        if (!loja) return jsonResp({ error: "Loja not found or not owned by user" }, 403);

        // Billing always follows the loja owner (works for admin visualization mode too)
        const billingUserId = loja.user_id || userId;

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
                price = await getWhatsAppPrice(supabaseAdmin, billingUserId);

                const { data: debited, error: debitErr } = await supabaseAdmin.rpc("debit_user_credits", {
                    _user_id: billingUserId,
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
                        user_id: billingUserId,
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

            // Build instance name using owner email for easy identification in UAZAPI
            const { data: ownerProfile } = await supabaseAdmin
                .from("profiles")
                .select("email")
                .eq("id", billingUserId)
                .maybeSingle();
            const emailPrefix = (ownerProfile?.email || "")
                .split("@")[0]
                .replace(/[^a-zA-Z0-9]/g, "")
                .slice(0, 20)
                .toLowerCase();
            const instanceName = body.instance_name || `magnus-${emailPrefix || loja_id.slice(0, 8)}-${Date.now().toString(36)}`;

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
                    subscription_price: price || (await getWhatsAppPrice(supabaseAdmin, billingUserId)),
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
            const price = await getWhatsAppPrice(supabaseAdmin, billingUserId);

            const { data: debited, error: debitErr } = await supabaseAdmin.rpc("debit_user_credits", {
                _user_id: billingUserId,
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
                        user_id: billingUserId,
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

            const qrCode = data.instance?.qrcode || data.qrcode || data.qr_code || null;
            const pairingCode = data.instance?.paircode || data.pairingCode || data.pairing_code || null;

            await supabaseAdmin
                .from("whatsapp_instances")
                .update({
                    status: "connecting",
                    qr_code: qrCode,
                    pairing_code: pairingCode,
                    phone: body.phone || null,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", instance.id);

            return jsonResp({ success: true, qrcode: qrCode, pairingCode: pairingCode });
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
            const inst = data.instance || {};
            const newStatus = inst.status || data.status || data.state || "disconnected";
            const qrCode = inst.qrcode || data.qrcode || data.qr_code || instance?.qr_code || null;
            const pairingCode = inst.paircode || data.pairingCode || data.pairing_code || instance?.pairing_code || null;

            await supabaseAdmin
                .from("whatsapp_instances")
                .update({
                    status: newStatus,
                    qr_code: qrCode,
                    pairing_code: pairingCode,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", instance.id);

            return jsonResp({
                success: true,
                status: newStatus,
                qrcode: qrCode,
                pairingCode: pairingCode,
                instance_name: instance?.instance_name,
                phone: instance?.phone,
                expires_at: instance?.expires_at,
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

            console.log("SEND action received body:", JSON.stringify({ number: body.number, btn_text: body.btn_text, btn_url: body.btn_url, btn2_text: body.btn2_text, btn2_url: body.btn2_url, reply_text: body.reply_text, image_url: body.image_url }));
            const { number, text, btn_text, btn_url, footer, envio_id, image_url, reply_text, btn2_text, btn2_url } = body;

            if (!number || !text) {
                return jsonResp({ error: "number and text are required" }, 400);
            }

            const choices: string[] = [];
            if (btn_text && btn_url) choices.push(`${btn_text}|${btn_url}`);
            if (btn2_text && btn2_url) choices.push(`${btn2_text}|${btn2_url}`);
            if (reply_text) choices.push(reply_text);

            const sendBody: Record<string, unknown> = {
                number,
                type: "button",
                text: image_url ? `\n${text}` : text,
                choices,
            };
            if (image_url) sendBody.imageButton = image_url;
            if (footer) sendBody.footerText = footer;

            console.log("UAZAPI send payload:", JSON.stringify(sendBody));

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

        // ── SEND-QUEUE: Bulk send via queue (respects delay, works offline) ──
        if (action === "send-queue") {
            console.log("SEND-QUEUE action received body:", JSON.stringify({ envio_ids_count: body.envio_ids?.length, btn_text: body.btn_text, btn_url_template: body.btn_url_template, btn2_text: body.btn2_text, btn2_url: body.btn2_url, footer: body.footer }));
            const { envio_ids, msg_template, btn_text, btn_url_template, footer, btn2_text: queueBtn2Text, btn2_url: queueBtn2Url } = body;

            if (!envio_ids || !Array.isArray(envio_ids) || envio_ids.length === 0) {
                return jsonResp({ error: "envio_ids array is required" }, 400);
            }

            // Fetch active connected instances
            const { data: allInstances } = await supabaseAdmin
                .from("whatsapp_instances")
                .select("*")
                .eq("loja_id", loja_id)
                .eq("status", "connected");

            let activeInstances = (allInstances || []).filter(
                (i: any) => i.expires_at && new Date(i.expires_at) > new Date()
            );

            const requestedInstanceIds: string[] | undefined = body.instance_ids;
            if (requestedInstanceIds && Array.isArray(requestedInstanceIds) && requestedInstanceIds.length > 0) {
                const idSet = new Set(requestedInstanceIds);
                const filtered = activeInstances.filter((i: any) => idSet.has(i.id));
                if (filtered.length > 0) activeInstances = filtered;
            }

            if (activeInstances.length === 0) {
                return jsonResp({ error: "Nenhuma instância WhatsApp ativa e conectada encontrada." }, 400);
            }

            // Fetch envios data
            const { data: enviosData } = await supabaseAdmin
                .from("envios")
                .select("*")
                .in("id", envio_ids);

            if (!enviosData || enviosData.length === 0) {
                return jsonResp({ error: "No envios found" }, 404);
            }

            // Fetch config for delay and extras
            const { data: configData } = await supabaseAdmin
                .from("postagem_config")
                .select("whatsapp_delay_seconds, whatsapp_image_url, whatsapp_reply_text, whatsapp_btn2_text, whatsapp_btn2_url")
                .eq("loja_id", loja_id)
                .maybeSingle();

            const delaySeconds = (configData?.whatsapp_delay_seconds) || 300;
            const queueImageUrl = configData?.whatsapp_image_url || null;
            const queueReplyText = configData?.whatsapp_reply_text || null;
            const cfgBtn2Text = queueBtn2Text || configData?.whatsapp_btn2_text || null;
            const cfgBtn2Url = queueBtn2Url || configData?.whatsapp_btn2_url || null;

            // Build queue items with staggered scheduled_at and round-robin instance assignment
            const queueItems: any[] = [];
            const baseTime = Date.now();

            for (let i = 0; i < enviosData.length; i++) {
                const envio = enviosData[i];
                const inst = activeInstances[i % activeInstances.length];

                if (!envio.cliente_telefone) continue;

                let produtoNome = envio.produto;
                try {
                    const parsed = JSON.parse(envio.produto);
                    if (Array.isArray(parsed)) produtoNome = parsed.map((p: any) => p.nome).join(", ");
                } catch { /* not JSON */ }

                const text = (msg_template || envio.produto)
                    .replace(/\{\{nome\}\}/g, envio.cliente_nome || "")
                    .replace(/\{\{produto\}\}/g, produtoNome)
                    .replace(/\{\{valor\}\}/g, Number(envio.valor || 0).toFixed(2))
                    .replace(/\{\{codigo_rastreio\}\}/g, envio.codigo_rastreio || "");

                const number = normalizeBrazilianPhone(envio.cliente_telefone);

                const choices: string[] = [];
                if (btn_text && btn_url_template) {
                    choices.push(`${btn_text}|${btn_url_template.replace("{{codigo_rastreio}}", envio.codigo_rastreio || "")}`);
                }
                if (cfgBtn2Text && cfgBtn2Url) choices.push(`${cfgBtn2Text}|${cfgBtn2Url}`);
                if (queueReplyText) choices.push(queueReplyText);

                // Stagger by delay: first item now, subsequent items spaced by delaySeconds
                const scheduledAt = new Date(baseTime + i * delaySeconds * 1000).toISOString();

                queueItems.push({
                    loja_id,
                    envio_id: envio.id,
                    instance_id: inst.id,
                    number,
                    msg_text: queueImageUrl ? `\n${text}` : text,
                    choices: JSON.stringify(choices),
                    image_url: queueImageUrl || null,
                    footer_text: footer || null,
                    scheduled_at: scheduledAt,
                    status: "pending",
                });
            }

            if (queueItems.length === 0) {
                return jsonResp({ error: "Nenhum envio com telefone válido encontrado." }, 400);
            }

            // Insert all queue items
            const { error: queueErr } = await supabaseAdmin
                .from("whatsapp_send_queue")
                .insert(queueItems);

            if (queueErr) {
                console.error("Failed to insert queue items:", queueErr);
                return jsonResp({ error: "Erro ao enfileirar mensagens", details: queueErr.message }, 500);
            }

            console.log(`Queued ${queueItems.length} WhatsApp messages for loja ${loja_id}`);

            return jsonResp({
                success: true,
                queued: queueItems.length,
                total_instances: activeInstances.length,
                delay_seconds: delaySeconds,
                estimated_minutes: Math.ceil((queueItems.length * delaySeconds) / 60),
            });
        }

        return jsonResp({ error: `Unknown action: ${action}` }, 400);
    } catch (error: unknown) {
        console.error("Error in send-whatsapp:", error);
        const msg = error instanceof Error ? error.message : "Unknown error";
        return jsonResp({ error: msg }, 500);
    }
});
