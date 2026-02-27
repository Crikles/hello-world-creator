import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to get ArrayBuffer from Uint8Array for crypto APIs
function toBuffer(arr: Uint8Array): ArrayBuffer {
    return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength);
}

// ── Helpers ──────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

function uint8ArrayToUrlBase64(uint8Array: Uint8Array): string {
    let str = "";
    for (const byte of uint8Array) {
        str += String.fromCharCode(byte);
    }
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function concat(...arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((sum, a) => sum + a.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const a of arrays) {
        result.set(a, offset);
        offset += a.length;
    }
    return result;
}

// ── VAPID JWT ────────────────────────────────────────────────────────

async function createVapidJwt(
    audience: string,
    subject: string,
    privateKeyBase64: string
): Promise<string> {
    const header = { typ: "JWT", alg: "ES256" };
    const now = Math.floor(Date.now() / 1000);
    const payload = { aud: audience, exp: now + 12 * 60 * 60, sub: subject };

    const encoder = new TextEncoder();
    const headerB64 = uint8ArrayToUrlBase64(encoder.encode(JSON.stringify(header)));
    const payloadB64 = uint8ArrayToUrlBase64(encoder.encode(JSON.stringify(payload)));
    const unsignedToken = `${headerB64}.${payloadB64}`;

    const privateKeyBytes = urlBase64ToUint8Array(privateKeyBase64);
    const cryptoKey = await crypto.subtle.importKey(
        "pkcs8",
        toBuffer(privateKeyBytes),
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign"]
    );

    const signature = await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        cryptoKey,
        encoder.encode(unsignedToken)
    );

    const sigB64 = uint8ArrayToUrlBase64(new Uint8Array(signature));
    return `${unsignedToken}.${sigB64}`;
}

// ── RFC 8291 Payload Encryption ──────────────────────────────────────

async function hkdfExtractAndExpand(
    salt: Uint8Array,
    ikm: Uint8Array,
    info: Uint8Array,
    length: number
): Promise<Uint8Array> {
    const saltBuf = salt.length ? toBuffer(salt) : new ArrayBuffer(32);
    const saltKey = await crypto.subtle.importKey(
        "raw",
        saltBuf,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const prk = new Uint8Array(await crypto.subtle.sign("HMAC", saltKey, toBuffer(ikm)));

    const prkKey = await crypto.subtle.importKey("raw", toBuffer(prk), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const t1Input = concat(info, new Uint8Array([1]));
    const t1 = new Uint8Array(await crypto.subtle.sign("HMAC", prkKey, toBuffer(t1Input)));
    return t1.slice(0, length);
}

async function encryptPayload(
    plaintext: Uint8Array,
    subscriberPublicKeyBase64: string,
    subscriberAuthBase64: string
): Promise<Uint8Array> {
    const subscriberPublicKeyBytes = urlBase64ToUint8Array(subscriberPublicKeyBase64);
    const subscriberAuth = urlBase64ToUint8Array(subscriberAuthBase64);

    const subscriberPubKey = await crypto.subtle.importKey(
        "raw",
        toBuffer(subscriberPublicKeyBytes),
        { name: "ECDH", namedCurve: "P-256" },
        true,
        []
    );

    const localKeyPair = await crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveBits"]
    );

    const localPublicKeyRaw = new Uint8Array(
        await crypto.subtle.exportKey("raw", localKeyPair.publicKey)
    );

    const sharedSecretBits = await crypto.subtle.deriveBits(
        { name: "ECDH", public: subscriberPubKey },
        localKeyPair.privateKey,
        256
    );
    const sharedSecret = new Uint8Array(sharedSecretBits);

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const encoder = new TextEncoder();

    const ikmInfo = concat(
        encoder.encode("WebPush: info\0"),
        subscriberPublicKeyBytes,
        localPublicKeyRaw
    );
    const ikm = await hkdfExtractAndExpand(subscriberAuth, sharedSecret, ikmInfo, 32);

    const cekInfo = concat(encoder.encode("Content-Encoding: aes128gcm\0"));
    const cek = await hkdfExtractAndExpand(salt, ikm, cekInfo, 16);

    const nonceInfo = concat(encoder.encode("Content-Encoding: nonce\0"));
    const nonce = await hkdfExtractAndExpand(salt, ikm, nonceInfo, 12);

    const padded = concat(plaintext, new Uint8Array([2]));

    const cekKey = await crypto.subtle.importKey("raw", toBuffer(cek), { name: "AES-GCM" }, false, ["encrypt"]);
    const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: toBuffer(nonce) },
            cekKey,
            toBuffer(padded)
        )
    );

    const rs = new Uint8Array(4);
    new DataView(rs.buffer).setUint32(0, 4096);
    const idlen = new Uint8Array([65]);

    return concat(salt, rs, idlen, localPublicKeyRaw, ciphertext);
}

// ── Send Web Push ────────────────────────────────────────────────────

async function sendWebPush(
    subscription: { endpoint: string; keys_p256dh: string; keys_auth: string },
    payload: string,
    vapidPublicKey: string,
    vapidPrivateKey: string,
    vapidSubject: string
): Promise<{ success: boolean; statusCode: number; statusText: string }> {
    try {
        const endpoint = new URL(subscription.endpoint);
        const audience = `${endpoint.protocol}//${endpoint.host}`;

        const jwt = await createVapidJwt(audience, vapidSubject, vapidPrivateKey);

        const encoder = new TextEncoder();
        const encryptedPayload = await encryptPayload(
            encoder.encode(payload),
            subscription.keys_p256dh,
            subscription.keys_auth
        );

        const response = await fetch(subscription.endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/octet-stream",
                "Content-Encoding": "aes128gcm",
                "Content-Length": String(encryptedPayload.byteLength),
                TTL: "86400",
                Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
            },
            body: toBuffer(encryptedPayload),
        });

        console.log(`Push to ${subscription.endpoint.slice(0, 60)}... => ${response.status} ${response.statusText}`);

        return {
            success: response.status >= 200 && response.status < 300,
            statusCode: response.status,
            statusText: response.statusText,
        };
    } catch (err: unknown) {
        console.error("sendWebPush error:", err);
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, statusCode: 0, statusText: msg };
    }
}

// ── Main Handler ─────────────────────────────────────────────────────

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { title, body, url, icon, codigoRastreio } = await req.json();

        if (!title || !body) {
            return new Response(
                JSON.stringify({ error: "title and body are required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
        const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

        if (!vapidPublicKey || !vapidPrivateKey) {
            return new Response(
                JSON.stringify({ error: "VAPID keys not configured" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey);

        const { data: settings } = await supabase
            .from("push_notification_settings")
            .select("*")
            .limit(1)
            .maybeSingle();

        const pushPayload = JSON.stringify({
            title,
            body,
            icon: icon || settings?.icon_url || "/favicon.ico",
            badge: settings?.badge_url || "/favicon.ico",
            url: url || settings?.default_url || "/",
        });

        let query = supabase.from("push_subscriptions").select("*");
        if (codigoRastreio) {
            query = query.eq("codigo_rastreio", codigoRastreio);
        }
        const { data: subscriptions, error: subError } = await query;
        if (subError) throw subError;

        let totalSent = 0;
        let totalFailed = 0;

        for (const sub of subscriptions || []) {
            const result = await sendWebPush(
                sub,
                pushPayload,
                vapidPublicKey,
                vapidPrivateKey,
                "mailto:contato@logisticajltransportes.com"
            );

            if (result.success) {
                totalSent++;
            } else {
                totalFailed++;
                if (result.statusCode === 410 || result.statusCode === 404) {
                    await supabase.from("push_subscriptions").delete().eq("id", sub.id);
                }
            }
        }

        await supabase.from("push_notification_log").insert({
            title,
            body,
            url: url || settings?.default_url || "/",
            icon_url: icon || settings?.icon_url || "/favicon.ico",
            total_sent: totalSent,
            total_failed: totalFailed,
        });

        return new Response(
            JSON.stringify({ success: true, totalSent, totalFailed }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err: unknown) {
        console.error("send-push-notification error:", err);
        const msg = err instanceof Error ? err.message : String(err);
        return new Response(
            JSON.stringify({ error: msg }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
