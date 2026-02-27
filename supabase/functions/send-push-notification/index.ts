import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
        privateKeyBytes,
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

async function hkdfDerive(
    salt: Uint8Array,
    ikm: Uint8Array,
    info: Uint8Array,
    length: number
): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey("raw", ikm, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const prk = new Uint8Array(await crypto.subtle.sign("HMAC", key, salt.length ? salt : new Uint8Array(32)));

    const prkKey = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    // T(1) = HMAC(PRK, info || 0x01)
    const t1Input = concat(info, new Uint8Array([1]));
    const t1 = new Uint8Array(await crypto.subtle.sign("HMAC", prkKey, t1Input));
    return t1.slice(0, length);
}

// Proper HKDF extract then expand
async function hkdfExtractAndExpand(
    salt: Uint8Array,
    ikm: Uint8Array,
    info: Uint8Array,
    length: number
): Promise<Uint8Array> {
    // Extract
    const saltKey = await crypto.subtle.importKey(
        "raw",
        salt.length ? salt : new Uint8Array(32),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const prk = new Uint8Array(await crypto.subtle.sign("HMAC", saltKey, ikm));

    // Expand
    const prkKey = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const t1Input = concat(info, new Uint8Array([1]));
    const t1 = new Uint8Array(await crypto.subtle.sign("HMAC", prkKey, t1Input));
    return t1.slice(0, length);
}

function createInfo(type: string, clientPublicKey: Uint8Array, serverPublicKey: Uint8Array): Uint8Array {
    const encoder = new TextEncoder();
    const typeBytes = encoder.encode(type);

    // "Content-Encoding: <type>\0" + "P-256\0" +
    // uint16(clientPublicKey.length) + clientPublicKey +
    // uint16(serverPublicKey.length) + serverPublicKey
    const header = encoder.encode("Content-Encoding: ");
    const nul = new Uint8Array([0]);
    const p256 = encoder.encode("P-256");

    const clientLen = new Uint8Array(2);
    new DataView(clientLen.buffer).setUint16(0, clientPublicKey.length);
    const serverLen = new Uint8Array(2);
    new DataView(serverLen.buffer).setUint16(0, serverPublicKey.length);

    return concat(
        header, typeBytes, nul,
        p256, nul,
        clientLen, clientPublicKey,
        serverLen, serverPublicKey
    );
}

async function encryptPayload(
    plaintext: Uint8Array,
    subscriberPublicKeyBase64: string,
    subscriberAuthBase64: string
): Promise<Uint8Array> {
    const subscriberPublicKeyBytes = urlBase64ToUint8Array(subscriberPublicKeyBase64);
    const subscriberAuth = urlBase64ToUint8Array(subscriberAuthBase64);

    // Import subscriber public key
    const subscriberPubKey = await crypto.subtle.importKey(
        "raw",
        subscriberPublicKeyBytes,
        { name: "ECDH", namedCurve: "P-256" },
        true,
        []
    );

    // Generate ephemeral key pair
    const localKeyPair = await crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveBits"]
    );

    // Export local public key (uncompressed, 65 bytes)
    const localPublicKeyRaw = new Uint8Array(
        await crypto.subtle.exportKey("raw", localKeyPair.publicKey)
    );

    // ECDH shared secret
    const sharedSecretBits = await crypto.subtle.deriveBits(
        { name: "ECDH", public: subscriberPubKey },
        localKeyPair.privateKey,
        256
    );
    const sharedSecret = new Uint8Array(sharedSecretBits);

    // Generate 16-byte salt
    const salt = crypto.getRandomValues(new Uint8Array(16));

    const encoder = new TextEncoder();

    // IKM derivation (RFC 8291 Section 3.3)
    // PRK_combine = HKDF-Extract(subscriberAuth, sharedSecret)
    // IKM = HKDF-Expand(PRK_combine, "WebPush: info\0" || subscriberPubKey || localPubKey, 32)
    const ikmInfo = concat(
        encoder.encode("WebPush: info\0"),
        subscriberPublicKeyBytes,
        localPublicKeyRaw
    );
    const ikm = await hkdfExtractAndExpand(subscriberAuth, sharedSecret, ikmInfo, 32);

    // CEK derivation (RFC 8188)
    const cekInfo = concat(encoder.encode("Content-Encoding: aes128gcm\0"));
    const cek = await hkdfExtractAndExpand(salt, ikm, cekInfo, 16);

    // Nonce derivation
    const nonceInfo = concat(encoder.encode("Content-Encoding: nonce\0"));
    const nonce = await hkdfExtractAndExpand(salt, ikm, nonceInfo, 12);

    // Add padding delimiter (RFC 8188 Section 2)
    // plaintext || 0x02 (final record delimiter)
    const padded = concat(plaintext, new Uint8Array([2]));

    // Encrypt with AES-128-GCM
    const cekKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
    const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: nonce },
            cekKey,
            padded
        )
    );

    // Build aes128gcm record:
    // salt (16) || rs (4, uint32 big-endian) || idlen (1) || keyid (65) || ciphertext
    const rs = new Uint8Array(4);
    new DataView(rs.buffer).setUint32(0, 4096);

    const idlen = new Uint8Array([65]); // length of uncompressed P-256 key

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

        // Encrypt the payload per RFC 8291
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
            body: encryptedPayload,
        });

        console.log(`Push to ${subscription.endpoint.slice(0, 60)}... => ${response.status} ${response.statusText}`);

        return {
            success: response.status >= 200 && response.status < 300,
            statusCode: response.status,
            statusText: response.statusText,
        };
    } catch (err) {
        console.error("sendWebPush error:", err);
        return { success: false, statusCode: 0, statusText: err.message };
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
    } catch (err) {
        console.error("send-push-notification error:", err);
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
