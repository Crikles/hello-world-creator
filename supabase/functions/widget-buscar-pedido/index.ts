// Public endpoint for the embeddable tracking widget.
// Accepts:
//   - loja_id (required)
//   - numero (optional — número do pedido)
//   - email OR cpf (pelo menos um)
//
// Se houver `numero`, faz match exato (numero + contato).
// Se NÃO houver `numero`, busca os envios mais recentes daquela loja que
// batem com o contato (email ou cpf) e devolve até 5 opções pro lead escolher.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeEmail = (e: string) => (e || "").trim().toLowerCase();
const normalizeOrder = (n: string) => (n || "").trim().replace(/^#/, "").toUpperCase();
const normalizeCpf = (c: string) => (c || "").replace(/\D/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const loja_id = url.searchParams.get("loja_id") || "";
    const numero = normalizeOrder(url.searchParams.get("numero") || "");
    const email = normalizeEmail(url.searchParams.get("email") || "");
    const cpf = normalizeCpf(url.searchParams.get("cpf") || "");

    if (!loja_id || loja_id.length < 10) return json({ error: "loja_id inválido" }, 400);
    if (!email && !cpf) return json({ error: "Informe e-mail ou CPF" }, 400);
    if (cpf && cpf.length !== 11) return json({ error: "CPF inválido" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verifica se widget está ativo
    const { data: cfg } = await supabase
      .from("postagem_config")
      .select("widget_rastreio_ativo")
      .eq("loja_id", loja_id)
      .maybeSingle();

    if (cfg && cfg.widget_rastreio_ativo === false) {
      return json({ error: "Widget desativado para esta loja" }, 403);
    }

    // ---------- Caminho 1: tem número do pedido ----------
    if (numero) {
      const { data: pedidos } = await supabase
        .from("pedidos")
        .select("id, transaction_token, customer_email, customer_document, envio_id")
        .eq("loja_id", loja_id)
        .or(`transaction_token.ilike.${numero},transaction_token.ilike.%${numero}`)
        .limit(20);

      const matchPedido = (p: any) => {
        if (!p?.envio_id) return false;
        if (email && normalizeEmail(p.customer_email || "") === email) return true;
        if (cpf && normalizeCpf(p.customer_document || "") === cpf) return true;
        return false;
      };

      let matched: any = (pedidos || []).find(matchPedido);

      if (!matched) {
        const { data: byId } = await supabase
          .from("pedidos")
          .select("id, customer_email, customer_document, envio_id")
          .eq("loja_id", loja_id)
          .ilike("id", `%${numero.toLowerCase()}%`)
          .limit(10);
        matched = (byId || []).find(matchPedido);
      }

      if (matched?.envio_id) {
        const { data: envio } = await supabase
          .from("envios")
          .select("codigo_rastreio")
          .eq("id", matched.envio_id)
          .maybeSingle();
        if (envio?.codigo_rastreio) return json({ codigo_rastreio: envio.codigo_rastreio });
      }

      // Fallback: envios direto
      let q = supabase
        .from("envios")
        .select("id, cliente_email, cliente_cpf, codigo_rastreio")
        .eq("loja_id", loja_id)
        .is("deleted_at", null);
      if (email) q = q.ilike("cliente_email", email);
      else if (cpf) q = q.eq("cliente_cpf", cpf);
      const { data: envios } = await q.limit(20);
      const hit = (envios || []).find((e) =>
        (e.id as string).toLowerCase().includes(numero.toLowerCase()) ||
        (e.codigo_rastreio || "").toUpperCase().includes(numero)
      );
      if (hit?.codigo_rastreio) return json({ codigo_rastreio: hit.codigo_rastreio });

      return json({ error: "Pedido não encontrado. Verifique o número e o contato." }, 404);
    }

    // ---------- Caminho 2: só contato (email/cpf) ----------
    let q = supabase
      .from("envios")
      .select("id, codigo_rastreio, produto, created_at, status, cliente_email, cliente_cpf")
      .eq("loja_id", loja_id)
      .is("deleted_at", null)
      .not("codigo_rastreio", "is", null)
      .order("created_at", { ascending: false })
      .limit(5);
    if (email) q = q.ilike("cliente_email", email);
    else if (cpf) q = q.eq("cliente_cpf", cpf);

    const { data: envios } = await q;

    if (!envios || envios.length === 0) {
      // tentativa adicional via pedidos (caso o envio não tenha cliente_email preenchido)
      let pq = supabase
        .from("pedidos")
        .select("envio_id, created_at")
        .eq("loja_id", loja_id)
        .not("envio_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(5);
      if (email) pq = pq.ilike("customer_email", email);
      else if (cpf) pq = pq.eq("customer_document", cpf);
      const { data: peds } = await pq;
      const ids = (peds || []).map((p) => p.envio_id).filter(Boolean) as string[];
      if (ids.length) {
        const { data: envs2 } = await supabase
          .from("envios")
          .select("id, codigo_rastreio, produto, created_at, status")
          .in("id", ids)
          .not("codigo_rastreio", "is", null);
        if (envs2 && envs2.length) {
          const matches = envs2.map((e) => ({
            codigo_rastreio: e.codigo_rastreio,
            produto: e.produto,
            created_at: e.created_at,
            status: e.status,
          }));
          if (matches.length === 1) return json({ codigo_rastreio: matches[0].codigo_rastreio });
          return json({ matches });
        }
      }
      return json({ error: "Nenhum pedido encontrado para esse contato." }, 404);
    }

    if (envios.length === 1) return json({ codigo_rastreio: envios[0].codigo_rastreio });

    return json({
      matches: envios.map((e) => ({
        codigo_rastreio: e.codigo_rastreio,
        produto: e.produto,
        created_at: e.created_at,
        status: e.status,
      })),
    });
  } catch (err) {
    console.error("widget-buscar-pedido error:", err);
    return json({ error: err instanceof Error ? err.message : "Erro interno" }, 500);
  }
});
