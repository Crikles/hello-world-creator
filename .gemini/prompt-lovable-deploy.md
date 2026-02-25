# Prompt para Lovable — Deploy das Edge Functions

Cole este prompt na Lovable:

---

Preciso que você faça o deploy de 2 novas Supabase Edge Functions e atualize a `send-email` existente. NÃO modifique nenhum arquivo frontend — apenas as Edge Functions.

## 1. CRIAR Edge Function `rastreio-info`

Crie o arquivo `supabase/functions/rastreio-info/index.ts` com o seguinte conteúdo EXATO:

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const codigo = url.searchParams.get("codigo");

        if (!codigo || codigo.trim().length < 3) {
            return new Response(
                JSON.stringify({ error: "Código de rastreio inválido" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        const { data: envio, error: envioError } = await supabase
            .from("envios")
            .select("id, produto, codigo_rastreio, cliente_nome, transportadora, status, ultimo_evento_ordem, created_at, updated_at, empresa_id, loja_id, valor")
            .eq("codigo_rastreio", codigo.trim().toUpperCase())
            .maybeSingle();

        if (envioError || !envio) {
            return new Response(
                JSON.stringify({ error: "Código de rastreio não encontrado" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        let empresa = null;
        if (envio.empresa_id) {
            const { data } = await supabase
                .from("empresas")
                .select("nome_fantasia, razao_social, logo_url")
                .eq("id", envio.empresa_id)
                .maybeSingle();
            empresa = data;
        }

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
                .select("template_ativo_id, ativar_site_rastreio, ativar_taxacao")
                .eq("loja_id", envio.loja_id)
                .maybeSingle();

            if (config?.template_ativo_id) {
                const { data: allEvents } = await supabase
                    .from("postagem_eventos")
                    .select("nome, descricao, status_label, ordem, delay_horas")
                    .eq("template_id", config.template_ativo_id)
                    .lte("ordem", envio.ultimo_evento_ordem)
                    .order("ordem", { ascending: true });

                if (allEvents) {
                    eventos = allEvents.filter((e) => {
                        if (e.status_label === "Taxação" || e.status_label === "Pago") {
                            return config.ativar_taxacao;
                        }
                        return true;
                    });
                }

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
                            cliente_nome: envio.cliente_nome,
                            transportadora: envio.transportadora || "JL Transportes",
                            status: envio.status,
                            ultimo_evento_ordem: envio.ultimo_evento_ordem,
                            created_at: envio.created_at,
                            updated_at: envio.updated_at,
                        },
                        empresa: empresa ? {
                            nome_fantasia: empresa.nome_fantasia,
                            razao_social: empresa.razao_social,
                            logo_url: empresa.logo_url,
                        } : null,
                        eventos,
                        totalEventos: totalCount ?? 0,
                    }),
                    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
        }

        return new Response(
            JSON.stringify({
                envio: {
                    id: envio.id,
                    produto: envio.produto,
                    codigo_rastreio: envio.codigo_rastreio,
                    cliente_nome: envio.cliente_nome,
                    transportadora: envio.transportadora || "JL Transportes",
                    status: envio.status,
                    ultimo_evento_ordem: envio.ultimo_evento_ordem,
                    created_at: envio.created_at,
                    updated_at: envio.updated_at,
                },
                empresa: empresa ? {
                    nome_fantasia: empresa.nome_fantasia,
                    razao_social: empresa.razao_social,
                    logo_url: empresa.logo_url,
                } : null,
                eventos: [],
                totalEventos: 0,
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
```

## 2. CRIAR Edge Function `pagamento-info`

Crie o arquivo `supabase/functions/pagamento-info/index.ts` com o seguinte conteúdo EXATO:

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

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
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        const { data: envio, error: envioError } = await supabase
            .from("envios")
            .select("id, produto, codigo_rastreio, cliente_nome, transportadora, valor, empresa_id, loja_id")
            .eq("id", envioId)
            .maybeSingle();

        if (envioError || !envio) {
            return new Response(
                JSON.stringify({ error: "Envio não encontrado" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        let empresa = null;
        if (envio.empresa_id) {
            const { data } = await supabase
                .from("empresas")
                .select("nome_fantasia, razao_social, logo_url")
                .eq("id", envio.empresa_id)
                .maybeSingle();
            empresa = data;
        }

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

        return new Response(
            JSON.stringify({
                envio: {
                    id: envio.id,
                    produto: envio.produto,
                    codigo_rastreio: envio.codigo_rastreio,
                    cliente_nome: envio.cliente_nome,
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
```

## 3. ATUALIZAR `send-email` — NÃO substituir, apenas garantir o deploy

A function `send-email` já existe em `supabase/functions/send-email/index.ts`. Ela já foi modificada anteriormente. Apenas faça o re-deploy dela sem alterar o código.

## IMPORTANTE

- As 3 Edge Functions usam `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` que já estão disponíveis automaticamente no ambiente Deno do Supabase.
- `rastreio-info` e `pagamento-info` são endpoints PÚBLICOS (acessados sem login do usuário).
- NÃO modifique nenhum componente React, apenas faça deploy das Edge Functions.
- Faça deploy das 3: `rastreio-info`, `pagamento-info`, `send-email`.

---
