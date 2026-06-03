import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function maskCpf(cpf: string | null): string | null {
  if (!cpf) return null;
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return '***.***.***-**';
  return `***.${digits.slice(3, 6)}.${digits[6]}**-**`;
}

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

/** Parse falha settings from corpo_email tags */
function parseFalhaSettings(corpo: string) {
    const corBotaoMatch = corpo.match(/\{\{falha_cor_botao:([^}]*)\}\}/);
    const corDestaqueMatch = corpo.match(/\{\{falha_cor_destaque:([^}]*)\}\}/);
    const corTituloResumoMatch = corpo.match(/\{\{falha_cor_titulo_resumo:([^}]*)\}\}/);
    const corLabelTaxaMatch = corpo.match(/\{\{falha_cor_label_taxa:([^}]*)\}\}/);
    const corDescricaoMatch = corpo.match(/\{\{falha_cor_descricao:([^}]*)\}\}/);
    const corFundoDescricaoMatch = corpo.match(/\{\{falha_cor_fundo_descricao:([^}]*)\}\}/);
    const corBordaDescricaoMatch = corpo.match(/\{\{falha_cor_borda_descricao:([^}]*)\}\}/);
    const mensagemSiteMatch = corpo.match(/\{\{falha_mensagem_site:([^}]*)\}\}/);

    return {
        cor_botao: corBotaoMatch?.[1] || null,
        cor_destaque: corDestaqueMatch?.[1] || null,
        cor_titulo_resumo: corTituloResumoMatch?.[1] || null,
        cor_label_taxa: corLabelTaxaMatch?.[1] || null,
        cor_descricao: corDescricaoMatch?.[1] || null,
        cor_fundo_descricao: corFundoDescricaoMatch?.[1] || null,
        cor_borda_descricao: corBordaDescricaoMatch?.[1] || null,
        mensagem_site: mensagemSiteMatch?.[1] || null,
    };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const envioId = url.searchParams.get("envio_id")
    const codigo = url.searchParams.get("codigo")
    const key = (envioId || codigo || "").trim()

    if (!key) {
      return new Response(JSON.stringify({ error: "envio_id or codigo is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const isUuid = UUID_RE.test(key)
    const baseSelect = "id, produto, codigo_rastreio, cliente_nome, cliente_cpf, cliente_endereco, cliente_numero, cliente_bairro, cliente_cidade, cliente_estado, cliente_cep, transportadora, valor, empresa_id, loja_id"

    const { data: envio, error: envioError } = isUuid
      ? await supabase.from("envios").select(baseSelect).eq("id", key).maybeSingle()
      : await supabase.from("envios").select(baseSelect).eq("codigo_rastreio", key.toUpperCase()).maybeSingle()

    if (envioError || !envio) {
      return new Response(JSON.stringify({ error: "Envio não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    let empresa = null
    if (envio.empresa_id) {
      const { data } = await supabase
        .from("empresas")
        .select("nome_fantasia, razao_social, logo_url")
        .eq("id", envio.empresa_id)
        .maybeSingle()
      empresa = data
    }
    if (!empresa && envio.loja_id) {
      const { data } = await supabase
        .from("empresas")
        .select("nome_fantasia, razao_social, logo_url")
        .eq("loja_id", envio.loja_id)
        .maybeSingle()
      empresa = data
    }

    let tax = null
    if (envio.loja_id) {
      const { data: config } = await supabase
        .from("postagem_config")
        .select("valor_taxa_falha, checkout_url_falha, ativar_falha_entrega, template_ativo_id")
        .eq("loja_id", envio.loja_id)
        .maybeSingle()

      if (config?.ativar_falha_entrega) {
        // Try to read color settings from the Falha Entrega evento corpo_email
        let falhaColors: Record<string, string | null> = {};
        if (config.template_ativo_id) {
          const { data: falhaEvento } = await supabase
            .from("postagem_eventos")
            .select("corpo_email")
            .eq("template_id", config.template_ativo_id)
            .eq("status_label", "Falha Entrega")
            .maybeSingle();

          if (falhaEvento?.corpo_email) {
            falhaColors = parseFalhaSettings(falhaEvento.corpo_email);
          }
        }

        tax = {
          mensagem_taxa: "Houve uma falha na tentativa de entrega do seu pedido. Para reenviarmos, precisamos que você pague a taxa de retentativa.",
          texto_botao: "PAGAR REENVIO",
          valor_exemplo: String(config.valor_taxa_falha || 0),
          prazo_dias: "5",
          url_pagamento: config.checkout_url_falha || "",
          cor_botao: falhaColors.cor_botao || "#ea580c",
          cor_header: "#ea580c",
          cor_destaque: falhaColors.cor_destaque || "#ea580c",
          cor_titulo_resumo: falhaColors.cor_titulo_resumo || "#020617",
          cor_label_taxa: falhaColors.cor_label_taxa || "#020617",
          cor_descricao: falhaColors.cor_descricao || "#9a3412",
          cor_fundo_descricao: falhaColors.cor_fundo_descricao || "#fff7ed",
          cor_borda_descricao: falhaColors.cor_borda_descricao || "#fed7aa80",
          mensagem_site: falhaColors.mensagem_site || "A transportadora não conseguiu concluir a entrega do seu pedido. O pacote retornou ao nosso centro de distribuição. Para realizarmos uma nova tentativa de envio, é necessário o pagamento da taxa de reenvio.",
          mostrar_valor: true,
          mostrar_prazo: true,
        }
      }
    }

    return new Response(
      JSON.stringify({
        envio: {
          id: envio.id,
          produto: formatProduto(envio.produto),
          codigo_rastreio: envio.codigo_rastreio,
          cliente_nome: envio.cliente_nome,
          cliente_cpf: maskCpf(envio.cliente_cpf),
          cliente_cidade: envio.cliente_cidade,
          cliente_estado: envio.cliente_estado,
          cliente_cep: envio.cliente_cep,
          transportadora: envio.transportadora || "JL Transportes",
          valor: envio.valor,
        },
        empresa: empresa
          ? {
            nome_fantasia: empresa.nome_fantasia,
            razao_social: empresa.razao_social,
            logo_url: empresa.logo_url,
          }
          : null,
        tax,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error: unknown) {
    console.error("Error in falha-info:", error)
    const msg = error instanceof Error ? error.message : "Unknown error"
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
