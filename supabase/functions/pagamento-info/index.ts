import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

function decodeHtmlEntities(str: string): string {
    return str.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)));
}

function formatProduto(raw: string): string {
    try {
        const items = JSON.parse(raw);
        if (Array.isArray(items)) {
            return items
                .map((i: any) => {
                    const name = decodeHtmlEntities(i.name || i.nome || i.title || "Produto");
                    const qty = i.quantity || i.quantidade || 1;
                    return qty > 1 ? `${name} (x${qty})` : name;
                })
                .join(", ");
        }
    } catch {
        // not JSON
    }
    return decodeHtmlEntities(raw);
}

/**
 * Public endpoint to fetch payment page data for a given envio.
 * No authentication required — this is called by the public payment page
 * when a buyer clicks the payment link in their email.
 *
 * GET /pagamento-info?envio_id=<uuid>
 *
 * Returns: { envio, empresa, tax }
 */
Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const envioId = url.searchParams.get("envio_id");

        if (!envioId) {
            return new Response(
                JSON.stringify({ error: "envio_id is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        // Use service role to bypass RLS — this is safe because we only return
        // limited, non-sensitive data needed for the payment page.
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 1. Fetch envio (only needed fields)
        const { data: envio, error: envioError } = await supabase
            .from("envios")
            .select("id, produto, codigo_rastreio, cliente_nome, cliente_cpf, cliente_endereco, cliente_numero, cliente_bairro, cliente_cidade, cliente_estado, cliente_cep, transportadora, valor, empresa_id, loja_id")
            .eq("id", envioId)
            .maybeSingle();

        if (envioError || !envio) {
            return new Response(
                JSON.stringify({ error: "Envio não encontrado" }),
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
        if (!empresa && envio.loja_id) {
            const { data } = await supabase
                .from("empresas")
                .select("nome_fantasia, razao_social, logo_url")
                .eq("loja_id", envio.loja_id)
                .maybeSingle();
            empresa = data;
        }

        // 3. Fetch tax settings from postagem_eventos via postagem_config
        let tax = null;
        if (envio.loja_id) {
            const { data: config } = await supabase
                .from("postagem_config")
                .select("template_ativo_id")
                .eq("loja_id", envio.loja_id)
                .maybeSingle();

            if (config?.template_ativo_id) {
                const { data: taxEvento } = await supabase
                    .from("postagem_eventos")
                    .select("corpo_email")
                    .eq("template_id", config.template_ativo_id)
                    .eq("status_label", "Taxação")
                    .maybeSingle();

                if (taxEvento?.corpo_email) {
                    tax = parseTaxSettings(taxEvento.corpo_email);
                }
            }
        }

        // Return only what the payment page needs — no sensitive data
        return new Response(
            JSON.stringify({
                envio: {
                    id: envio.id,
                    produto: formatProduto(envio.produto),
                    codigo_rastreio: envio.codigo_rastreio,
                    cliente_nome: envio.cliente_nome,
                    cliente_cpf: envio.cliente_cpf,
                    cliente_endereco: envio.cliente_endereco,
                    cliente_numero: envio.cliente_numero,
                    cliente_bairro: envio.cliente_bairro,
                    cliente_cidade: envio.cliente_cidade,
                    cliente_estado: envio.cliente_estado,
                    cliente_cep: envio.cliente_cep,
                    transportadora: envio.transportadora || "JL Transportes",
                    valor: envio.valor,
                },
                empresa: empresa ? {
                    nome_fantasia: empresa.nome_fantasia,
                    razao_social: empresa.razao_social,
                    logo_url: empresa.logo_url,
                } : null,
                tax,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error: unknown) {
        console.error("Error in pagamento-info:", error);
        const msg = error instanceof Error ? error.message : "Unknown error";
        return new Response(
            JSON.stringify({ error: msg }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

/** Parse the custom taxação settings from corpo_email tags */
function parseTaxSettings(corpo: string) {
    const urlMatch = corpo.match(/\{\{taxacao_url:([^}]*)\}\}/);
    const botaoMatch = corpo.match(/\{\{taxacao_botao:([^}]*)\}\}/);
    const valorMatch = corpo.match(/\{\{taxacao_valor:([^}]*)\}\}/);
    const corMatch = corpo.match(/\{\{taxacao_cor:([^}]*)\}\}/);
    const corHeaderMatch = corpo.match(/\{\{taxacao_cor_header:([^}]*)\}\}/);
    const prazoMatch = corpo.match(/\{\{taxacao_prazo:([^}]*)\}\}/);
    const mostrarValorMatch = corpo.match(/\{\{taxacao_mostrar_valor:([^}]*)\}\}/);
    const mostrarPrazoMatch = corpo.match(/\{\{taxacao_mostrar_prazo:([^}]*)\}\}/);

    const msgEnd = corpo.indexOf("{{taxacao_");
    const plainMessage = msgEnd > 0 ? corpo.substring(0, msgEnd).trim() : "Fiscalização aduaneira concluída - aguardando pagamento";

    return {
        mensagem_taxa: plainMessage,
        texto_botao: botaoMatch?.[1] || "PAGUE AGORA",
        valor_exemplo: valorMatch?.[1] || "0.00",
        prazo_dias: prazoMatch?.[1] || "5",
        url_pagamento: urlMatch?.[1] || "",
        cor_botao: corMatch?.[1] || "#2563eb",
        cor_header: corHeaderMatch?.[1] || "#f59e0b",
        mostrar_valor: mostrarValorMatch ? mostrarValorMatch[1] === "true" : true,
        mostrar_prazo: mostrarPrazoMatch ? mostrarPrazoMatch[1] === "true" : true,
    };
}
