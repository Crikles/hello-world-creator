import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const envioId = url.searchParams.get("envio_id")

    if (!envioId) {
      return new Response(JSON.stringify({ error: "envio_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const { data: envio, error: envioError } = await supabase
      .from("envios")
      .select("id, produto, codigo_rastreio, cliente_nome, cliente_cpf, cliente_endereco, cliente_numero, cliente_bairro, cliente_cidade, cliente_estado, cliente_cep, transportadora, valor, empresa_id, loja_id")
      .eq("id", envioId)
      .maybeSingle()

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

    let tax = null
    if (envio.loja_id) {
      const { data: config } = await supabase
        .from("postagem_config")
        .select("valor_taxa_falha, checkout_url_falha, ativar_falha_entrega")
        .eq("loja_id", envio.loja_id)
        .maybeSingle()

      if (config?.ativar_falha_entrega) {
        tax = {
          mensagem_taxa: "Houve uma falha na tentativa de entrega do seu pedido. Para reenviarmos, precisamos que você pague a taxa de retentativa.",
          texto_botao: "PAGAR REENVIO",
          valor_exemplo: String(config.valor_taxa_falha || 0),
          prazo_dias: "5",
          url_pagamento: config.checkout_url_falha || "",
          cor_botao: "#ea580c",
          cor_header: "#ea580c",
          mostrar_valor: true,
          mostrar_prazo: true,
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
