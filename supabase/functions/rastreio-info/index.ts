import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

function maskName(name: string): string {
    if (!name) return "";
    const parts = name.trim().split(/\s+/);
    return parts.map((p) => {
        if (p.length <= 2) return p[0] + "*";
        return p[0] + "*".repeat(p.length - 1);
    }).join(" ");
}

type LivePingArgs = {
    lojaId: string;
    sessionId: string;
    codigoRastreio: string;
    action?: "heartbeat" | "disconnect";
};

const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
    BR: [-14.235, -51.9253],
    US: [39.8283, -98.5795],
    CA: [56.1304, -106.3468],
    MX: [23.6345, -102.5528],
    AR: [-38.4161, -63.6167],
    CL: [-35.6751, -71.543],
    CO: [4.5709, -74.2973],
    PE: [-9.19, -75.0152],
    PT: [39.3999, -8.2245],
    ES: [40.4637, -3.7492],
    FR: [46.2276, 2.2137],
    DE: [51.1657, 10.4515],
    IT: [41.8719, 12.5674],
    GB: [55.3781, -3.436],
    AU: [-25.2744, 133.7751],
    JP: [36.2048, 138.2529],
};

const BRAZIL_FALLBACK_POINTS: [number, number][] = [
    [-23.5505, -46.6333],
    [-22.9068, -43.1729],
    [-19.9167, -43.9345],
    [-15.7801, -47.9292],
    [-12.9777, -38.5016],
    [-8.0476, -34.877],
    [-3.7319, -38.5267],
    [-25.4296, -49.2719],
    [-30.0346, -51.2177],
    [-3.119, -60.0217],
];

function hashString(value: string): number {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function fallbackCoordinates(sessionId: string, codigoRastreio: string, paisCodigo: string | null): [number, number] {
    const code = (paisCodigo || "").toUpperCase();
    const seed = hashString(`${sessionId}|${codigoRastreio}|${code}`);

    if (code === "BR") {
        const base = BRAZIL_FALLBACK_POINTS[seed % BRAZIL_FALLBACK_POINTS.length];
        const latJitter = (((seed >> 8) % 1000) / 1000 - 0.5) * 1.8;
        const lngJitter = (((seed >> 18) % 1000) / 1000 - 0.5) * 2.4;
        return [
            clamp(base[0] + latJitter, -33.75, 5.3),
            clamp(base[1] + lngJitter, -73.99, -34.79),
        ];
    }

    const centroid = COUNTRY_CENTROIDS[code];
    if (centroid) {
        const latJitter = (((seed >> 8) % 1000) / 1000 - 0.5) * 6;
        const lngJitter = (((seed >> 18) % 1000) / 1000 - 0.5) * 8;
        return [
            clamp(centroid[0] + latJitter, -60, 75),
            clamp(centroid[1] + lngJitter, -180, 180),
        ];
    }

    return [
        clamp((((seed >> 6) % 1300) / 10) - 55, -55, 75),
        clamp((((seed >> 17) % 3600) / 10) - 180, -180, 180),
    ];
}

async function recordLivePing(
    supabase: ReturnType<typeof createClient>,
    req: Request,
    args: LivePingArgs,
): Promise<void> {
    const action = args.action ?? "heartbeat";
    console.log(`[live-ping] start loja=${args.lojaId} session=${args.sessionId.slice(0,8)} codigo=${args.codigoRastreio} action=${action}`);
    // Try existing row first (UPSERT-like behavior keyed on session+codigo)
    const { data: existing, error: selErr } = await supabase
        .from("live_view_pings")
        .select("id")
        .eq("session_id", args.sessionId)
        .eq("codigo_rastreio", args.codigoRastreio)
        .maybeSingle();

    if (selErr) console.error("[live-ping] select error:", selErr);

    if (action === "disconnect") {
        if (!existing?.id) return;
        const { error: delErr } = await supabase
            .from("live_view_pings")
            .delete()
            .eq("id", existing.id);
        if (delErr) console.error("[live-ping] disconnect delete error:", delErr);
        else console.log(`[live-ping] disconnected id=${existing.id}`);
        return;
    }

    if (existing?.id) {
        const { error: updErr } = await supabase
            .from("live_view_pings")
            .update({ last_seen_at: new Date().toISOString() })
            .eq("id", existing.id);
        if (updErr) console.error("[live-ping] update error:", updErr);
        else console.log(`[live-ping] heartbeat ok id=${existing.id}`);
        return;
    }

    // First ping for this session+codigo: resolve geolocation
    const headers = req.headers;
    const cfCountry = headers.get("cf-ipcountry") || headers.get("x-vercel-ip-country");
    const cfCity = headers.get("x-vercel-ip-city") || headers.get("cf-ipcity");
    const cfRegion = headers.get("x-vercel-ip-country-region") || headers.get("cf-region");
    const cfLat = headers.get("x-vercel-ip-latitude") || headers.get("cf-iplatitude");
    const cfLng = headers.get("x-vercel-ip-longitude") || headers.get("cf-iplongitude");

    let cidade: string | null = cfCity ? decodeURIComponent(cfCity) : null;
    let estado: string | null = cfRegion ? decodeURIComponent(cfRegion) : null;
    let pais: string | null = null;
    let paisCodigo: string | null = cfCountry || null;
    let lat: number | null = cfLat ? parseFloat(cfLat) : null;
    let lng: number | null = cfLng ? parseFloat(cfLng) : null;

    // Fallback to ipapi.co (only on first ping)
    if (!cidade || lat === null || lng === null) {
        try {
            const ip = (headers.get("x-forwarded-for") || "").split(",")[0].trim();
            if (ip) {
                const res = await fetch(`https://ipapi.co/${ip}/json/`, {
                    signal: AbortSignal.timeout(2500),
                });
                if (res.ok) {
                    const geo = await res.json();
                    cidade = cidade || geo.city || null;
                    estado = estado || geo.region || null;
                    pais = geo.country_name || null;
                    paisCodigo = paisCodigo || geo.country_code || null;
                    lat = lat ?? (typeof geo.latitude === "number" ? geo.latitude : null);
                    lng = lng ?? (typeof geo.longitude === "number" ? geo.longitude : null);
                }
            }
        } catch {
            /* swallow geo errors */
        }
    }

    if (lat === null || lng === null) {
        [lat, lng] = fallbackCoordinates(args.sessionId, args.codigoRastreio, paisCodigo);
    }

    const ua = (headers.get("user-agent") || "").slice(0, 200);

    const { error: insErr } = await supabase.from("live_view_pings").upsert({
        loja_id: args.lojaId,
        session_id: args.sessionId,
        codigo_rastreio: args.codigoRastreio,
        cidade,
        estado,
        pais,
        pais_codigo: paisCodigo,
        lat,
        lng,
        user_agent: ua,
        last_seen_at: new Date().toISOString(),
    }, { onConflict: "loja_id,session_id,codigo_rastreio" });
    if (insErr) console.error("[live-ping] upsert error:", insErr);
    else console.log(`[live-ping] upsert ok cidade=${cidade} estado=${estado}`);
}

/**
 * Public endpoint to fetch tracking data for a given codigo_rastreio.
 * No authentication required — accessed from the public tracking page.
 *
 * GET /rastreio-info?codigo=<TRACKING_CODE>
 *
 * Returns: { envio, empresa, eventos, config }
 */
Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const codigo = url.searchParams.get("codigo");
        let sessionId = url.searchParams.get("session_id") || req.headers.get("x-lv-session");
        const action = url.searchParams.get("action") === "disconnect" ? "disconnect" : "heartbeat";

        // Fallback: if the (possibly old) public build does not send a session_id,
        // derive a stable one from IP + User-Agent + day so the visitor still
        // appears in the Live View. Live build still has priority with its own UUID.
        if (!sessionId) {
            try {
                const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "0.0.0.0";
                const ua = req.headers.get("user-agent") || "unknown";
                const day = new Date().toISOString().slice(0, 10);
                const buf = new TextEncoder().encode(`${ip}|${ua}|${day}`);
                const hashBuf = await crypto.subtle.digest("SHA-256", buf);
                const hex = Array.from(new Uint8Array(hashBuf))
                    .map((b) => b.toString(16).padStart(2, "0"))
                    .join("");
                sessionId = "auto:" + hex.slice(0, 32);
            } catch (e) {
                console.error("[live-ping] fallback sessionId failed:", e);
            }
        }

        if (!codigo || codigo.trim().length < 3) {
            return new Response(
                JSON.stringify({ error: "Código de rastreio inválido" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 1. Find the envio by tracking code
        const { data: envio, error: envioError } = await supabase
            .from("envios")
            .select("id, produto, codigo_rastreio, cliente_nome, transportadora, status, ultimo_evento_ordem, created_at, updated_at, empresa_id, loja_id, valor, cliente_cidade, cliente_estado")
            .eq("codigo_rastreio", codigo.trim().toUpperCase())
            .maybeSingle();

        if (envioError || !envio) {
            return new Response(
                JSON.stringify({ error: "Código de rastreio não encontrado" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Live View ping — awaited so the row is guaranteed to be persisted
        // before the edge function shuts down. Wrapped to never break the response.
        if (sessionId && envio.loja_id) {
            try {
                await recordLivePing(supabase, req, {
                    lojaId: envio.loja_id,
                    sessionId: sessionId.slice(0, 64),
                    codigoRastreio: envio.codigo_rastreio || codigo.trim().toUpperCase(),
                    action,
                });
            } catch (e) {
                console.error("[live-ping] failed:", e);
            }
        }

        // 2. Fetch empresa
        let empresa = null;
        if (envio.empresa_id) {
            const { data } = await supabase
                .from("empresas")
                .select("nome_fantasia, razao_social, logo_url")
                .eq("id", envio.empresa_id)
                .maybeSingle();
            empresa = data;
        }

        // 3. Fetch all tracking events (up to ultimo_evento_ordem)
        let eventos: Array<{
            nome: string;
            descricao: string | null;
            status_label: string | null;
            ordem: number;
            delay_horas: number;
        }> = [];

        if (envio.loja_id) {
            const { data: config } = await supabase
                .from("postagem_config")
                .select("template_ativo_id, ativar_site_rastreio, ativar_taxacao, ativar_falha_entrega, origem_cidade, origem_estado, cor_primaria, ativar_vizinho")
                .eq("loja_id", envio.loja_id)
                .maybeSingle();

            // Prefer the template frozen on the shipment; fall back to the active store template
            const templateIdToUse = (envio as any).postagem_template_id || config?.template_ativo_id;

            if (templateIdToUse) {
                // Get ALL events up to the current ordem
                const { data: allEvents } = await supabase
                    .from("postagem_eventos")
                    .select("nome, descricao, status_label, ordem, delay_horas")
                    .eq("template_id", templateIdToUse)
                    .lte("ordem", envio.ultimo_evento_ordem)
                    .order("ordem", { ascending: true });

                if (allEvents) {
                    // Filter out Taxação and Pago events unless taxação is active
                    // Filter out Falha Entrega events unless falha_entrega is active
                    eventos = allEvents.filter((e) => {
                        if (e.nome === "Nota Fiscal Emitida") {
                            return false;
                        }
                        if (e.status_label === "Taxação" || e.status_label === "Pago") {
                            return config.ativar_taxacao;
                        }
                        if (e.status_label === "Falha Entrega" || e.nome === "Falha na Entrega") {
                            return config.ativar_falha_entrega;
                        }
                        return true;
                    });
                }

                // Also get total events count for progress
                const { count: totalCount } = await supabase
                    .from("postagem_eventos")
                    .select("*", { count: "exact", head: true })
                    .eq("template_id", config.template_ativo_id);

                return new Response(
                    JSON.stringify({
                        envio: {
                            id: envio.id,
                            produto: envio.produto,
                            codigo_rastreio: envio.codigo_rastreio,
                            cliente_nome: maskName(envio.cliente_nome),
                            transportadora: envio.transportadora || "JL Transportes",
                            status: envio.status,
                            ultimo_evento_ordem: envio.ultimo_evento_ordem,
                            created_at: envio.created_at,
                            updated_at: envio.updated_at,
                            cliente_cidade: envio.cliente_cidade,
                            cliente_estado: envio.cliente_estado,
                        },
                        empresa: empresa ? {
                            nome_fantasia: empresa.nome_fantasia,
                            razao_social: empresa.razao_social,
                            logo_url: empresa.logo_url,
                        } : null,
                        eventos,
                        totalEventos: totalCount ?? 0,
                        origem: {
                            cidade: config?.origem_cidade || null,
                            estado: config?.origem_estado || null,
                        },
                        cor_primaria: config?.cor_primaria || null,
                        ativar_vizinho: config?.ativar_vizinho ?? true,
                    }),
                    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
        }

        // Fallback — no config found
        return new Response(
            JSON.stringify({
                envio: {
                    id: envio.id,
                    produto: envio.produto,
                    codigo_rastreio: envio.codigo_rastreio,
                    cliente_nome: maskName(envio.cliente_nome),
                    transportadora: envio.transportadora || "JL Transportes",
                    status: envio.status,
                    ultimo_evento_ordem: envio.ultimo_evento_ordem,
                    created_at: envio.created_at,
                    updated_at: envio.updated_at,
                    cliente_cidade: envio.cliente_cidade,
                    cliente_estado: envio.cliente_estado,
                },
                empresa: empresa ? {
                    nome_fantasia: empresa.nome_fantasia,
                    razao_social: empresa.razao_social,
                    logo_url: empresa.logo_url,
                } : null,
                eventos: [],
                totalEventos: 0,
                origem: { cidade: null, estado: null },
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error: unknown) {
        console.error("Error in rastreio-info:", error);
        const msg = error instanceof Error ? error.message : "Unknown error";
        return new Response(
            JSON.stringify({ error: msg }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
