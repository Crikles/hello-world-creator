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
        const sessionId = url.searchParams.get("session_id");

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

            if (config?.template_ativo_id) {
                // Get ALL events up to the current ordem
                const { data: allEvents } = await supabase
                    .from("postagem_eventos")
                    .select("nome, descricao, status_label, ordem, delay_horas")
                    .eq("template_id", config.template_ativo_id)
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
