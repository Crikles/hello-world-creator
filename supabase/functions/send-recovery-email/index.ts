import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function replaceVariables(template: string, vars: Record<string, string>): string {
  let result = template;

  // Conditionals: {{#key}}content{{/key}}
  result = result.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_match, key, content) => {
    const val = vars[key];
    return val && val.trim() ? content : "";
  });

  // Simple variables: {{key}}
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || "");
  }

  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { loja_id, customer_email } = await req.json();

    if (!loja_id || !customer_email) {
      return new Response(JSON.stringify({ error: "Missing loja_id or customer_email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get config
    const { data: config } = await supabase
      .from("recovery_config")
      .select("*")
      .eq("loja_id", loja_id)
      .maybeSingle();

    if (!config || !config.ativo) {
      return new Response(JSON.stringify({ ok: false, message: "Recovery not active" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the lead
    const { data: lead } = await supabase
      .from("recovery_leads")
      .select("*")
      .eq("loja_id", loja_id)
      .eq("customer_email", customer_email)
      .eq("status", "pendente")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lead) {
      return new Response(JSON.stringify({ ok: false, message: "No pending lead found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get loja owner for debit
    const { data: loja } = await supabase
      .from("lojas")
      .select("user_id, nome")
      .eq("id", loja_id)
      .maybeSingle();

    if (!loja) {
      return new Response(JSON.stringify({ error: "Loja not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build products list
    const products = (lead.products || []) as { name: string; value: number; qty: number }[];
    const listaProdutos = products.map(p => `${p.name} (x${p.qty}) — R$ ${p.value.toFixed(2)}`).join("<br>");
    const produtoPrincipal = products.length > 0 ? products[0].name : "seu produto";
    const valorTotal = `R$ ${Number(lead.total_value || 0).toFixed(2).replace(".", ",")}`;

    // Build template variables
    const vars: Record<string, string> = {
      nome_cliente: lead.customer_name || "Cliente",
      email_cliente: lead.customer_email,
      lista_produtos: listaProdutos || "Seu pedido",
      nome_produto_principal: produtoPrincipal,
      valor_total: valorTotal,
      link_checkout: lead.checkout_url || "#",
      beneficio_principal: config.beneficio_principal || "",
      beneficio_1: config.beneficio_1 || "",
      beneficio_2: config.beneficio_2 || "",
      beneficio_3: config.beneficio_3 || "",
      garantia: config.garantia || "",
      ps_reforco_urgencia: config.ps_reforco_urgencia || "",
      existe_cupom: config.cupom_ativo ? "true" : "",
      codigo_cupom: config.codigo_cupom || "",
      descricao_cupom: config.descricao_cupom || "",
      nome_loja: loja.nome || "",
    };

    const subject = replaceVariables(config.assunto_email || "Você esqueceu algo 👀", vars);
    const bodyHtml = replaceVariables(config.corpo_email || "<p>Olá {{nome_cliente}}, finalize sua compra!</p>", vars);

    // Debit credits
    const { data: debitOk } = await supabase.rpc("debit_user_credits", {
      _user_id: loja.user_id,
      _quantidade: 0.50,
      _descricao: `Email de recuperação para ${lead.customer_email}`,
    });

    if (!debitOk) {
      // No credits - mark as failed
      await supabase
        .from("recovery_leads")
        .update({ status: "sem_credito" })
        .eq("id", lead.id);

      return new Response(JSON.stringify({ ok: false, message: "Insufficient credits" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send email via Resend
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const emailResponse = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY!,
      },
      body: JSON.stringify({
        from: "Magnus Frete <noreply@jltransportes.pro>",
        to: [lead.customer_email],
        subject,
        html: bodyHtml,
      }),
    });

    const emailResult = await emailResponse.json();

    // Update lead status
    await supabase
      .from("recovery_leads")
      .update({ status: "email_enviado", email_sent_at: new Date().toISOString() })
      .eq("id", lead.id);

    return new Response(JSON.stringify({ ok: true, email: emailResult }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-recovery-email error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
