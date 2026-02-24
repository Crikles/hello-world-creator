import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SendEmailRequest {
  envio_id: string;
  evento_id: string;
  loja_id: string;
  nfe_pdf_base64?: string;
  nfe_filename?: string;
}

function replaceVariables(
  text: string,
  envio: Record<string, unknown>,
  extras: Record<string, string> = {}
): string {
  let result = text
    .replace(/\{\{cliente_nome\}\}/g, (envio.cliente_nome as string) || "")
    .replace(/\{\{cliente_email\}\}/g, (envio.cliente_email as string) || "")
    .replace(/\{\{produto\}\}/g, (envio.produto as string) || "")
    .replace(/\{\{codigo_rastreio\}\}/g, (envio.codigo_rastreio as string) || "")
    .replace(/\{\{transportadora\}\}/g, (envio.transportadora as string) || "")
    .replace(/\{\{valor\}\}/g, String(envio.valor || "0"))
    .replace(/\{\{quantidade\}\}/g, String(envio.quantidade || "1"));

  for (const [key, value] of Object.entries(extras)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }

  const logoUrl = extras.empresa_logo_url || "";
  if (logoUrl) {
    result = result.replace(/\{\{#empresa_logo_url\}\}/g, "").replace(/\{\{\/empresa_logo_url\}\}/g, "");
  } else {
    result = result.replace(/\{\{#empresa_logo_url\}\}[\s\S]*?\{\{\/empresa_logo_url\}\}/g, "");
  }

  return result;
}

function markdownToHtml(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");
}

function getHeaderTitle(statusLabel: string, enviarNfePdf: boolean, empresaNome: string): string {
  if (enviarNfePdf) return empresaNome;
  const titleMap: Record<string, string> = {
    "Postado": "Pedido Postado",
    "Coletado": "Pedido Coletado",
    "Em Trânsito": "Pedido em Trânsito",
    "Em Rota": "Em Rota de Entrega",
    "Centro Local": "Centro de Distribuição",
    "Saiu para Entrega": "Saiu para Entrega!",
    "Entregue": "Pedido Entregue!",
    "Taxação": "Aviso de Taxação",
    "Pago": "Pagamento Confirmado",
  };
  return titleMap[statusLabel] || statusLabel || empresaNome;
}

function buildEmailHtml(
  evento: Record<string, unknown>,
  envio: Record<string, unknown>,
  extras: Record<string, string>,
  primaryColor = "#6366f1"
): string {
  const corpoEmail = (evento.corpo_email as string) || "";
  const statusLabel = (evento.status_label as string) || "";
  const enviarNfePdf = (evento.enviar_nfe_pdf as boolean) || false;

  let saudacao = `Olá {{cliente_nome}},`;
  let mensagem = corpoEmail || `Atualização sobre o seu pedido **{{produto}}**.`;
  let rodape = `Atenciosamente,\n{{empresa_nome}}`;
  let mostrarInfoPedido = true;
  let mostrarBotaoCta = true;
  let textoBotaoCta = "Rastrear Pedido";
  let urlBotaoCta = "https://rastreamento.correios.com.br/app/index.php";

  if (corpoEmail.includes("<p>") || corpoEmail.includes("<div>")) {
    mensagem = corpoEmail
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .trim();
  }

  if (statusLabel === "Entregue") {
    mostrarBotaoCta = false;
    textoBotaoCta = "";
    urlBotaoCta = "";
    rodape = `Obrigado pela preferência!\n{{empresa_nome}}`;
  }

  const saudacaoHtml = markdownToHtml(replaceVariables(saudacao, envio, extras));
  const mensagemHtml = markdownToHtml(replaceVariables(mensagem, envio, extras));
  const rodapeHtml = markdownToHtml(replaceVariables(rodape, envio, extras));

  const infoBlock = mostrarInfoPedido
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <tr style="background-color:#f9fafb;">
          <td style="padding:12px 16px;font-size:13px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Produto</td>
          <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#111827;border-bottom:1px solid #e5e7eb;">${replaceVariables("{{produto}}", envio, extras)}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;font-size:13px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Código de Rastreio</td>
          <td style="padding:12px 16px;font-size:13px;font-weight:600;color:${primaryColor};border-bottom:1px solid #e5e7eb;">${replaceVariables("{{codigo_rastreio}}", envio, extras)}</td>
        </tr>
        <tr style="background-color:#f9fafb;">
          <td style="padding:12px 16px;font-size:13px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Transportadora</td>
          <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#111827;border-bottom:1px solid #e5e7eb;">${replaceVariables("{{transportadora}}", envio, extras)}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;font-size:13px;color:#6b7280;">Valor</td>
          <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#111827;">R$ ${replaceVariables("{{valor}}", envio, extras)}</td>
        </tr>
      </table>`
    : "";

  const ctaBlock = mostrarBotaoCta && textoBotaoCta
    ? `<div style="text-align:center;margin:28px 0;">
        <a href="${urlBotaoCta}" style="display:inline-block;background-color:${primaryColor};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.3px;">${textoBotaoCta}</a>
      </div>`
    : "";

  const empresaNome = extras.empresa_nome || "Loja";
  const empresaLogoUrl = extras.empresa_logo_url || "";
  const headerTitle = getHeaderTitle(statusLabel, enviarNfePdf, empresaNome);

  const logoBlock = empresaLogoUrl
    ? `<img src="${empresaLogoUrl}" alt="${empresaNome}" style="max-height:120px;max-width:200px;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto;" />`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,${primaryColor},${primaryColor}dd);padding:32px 40px;text-align:center;">
              ${logoBlock}
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">${headerTitle}</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#374151;">${saudacaoHtml}</p>
              <div style="margin:0 0 8px;font-size:15px;line-height:1.7;color:#4b5563;">${mensagemHtml}</div>
              ${infoBlock}
              ${ctaBlock}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:13px;line-height:1.5;color:#9ca3af;text-align:center;">${rodapeHtml}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("send-email function invoked, method:", req.method);
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify user via token
    const anonClient = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await anonClient.auth.getUser();
    if (userError || !userData?.user) {
      console.error("Auth failed:", userError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("Authenticated user:", userData.user.id);

    const { envio_id, evento_id, loja_id, nfe_pdf_base64, nfe_filename } =
      (await req.json()) as SendEmailRequest;

    if (!envio_id || !evento_id || !loja_id) {
      throw new Error("Missing required fields: envio_id, evento_id, loja_id");
    }

    // Fetch envio data
    const { data: envio, error: envioError } = await supabase
      .from("envios")
      .select("*")
      .eq("id", envio_id)
      .single();

    if (envioError || !envio) {
      throw new Error(`Envio not found: ${envioError?.message}`);
    }

    // Fetch evento data
    const { data: evento, error: eventoError } = await supabase
      .from("postagem_eventos")
      .select("*")
      .eq("id", evento_id)
      .single();

    if (eventoError || !evento) {
      throw new Error(`Evento not found: ${eventoError?.message}`);
    }

    // Fetch postagem_config for sender email
    let emailRemetente = "noreply@jltransportes.pro";
    const { data: config } = await supabase
      .from("postagem_config")
      .select("email_remetente")
      .eq("loja_id", loja_id)
      .maybeSingle();

    if (config?.email_remetente) {
      emailRemetente = config.email_remetente;
    }

    // Fetch empresa data
    let fromName = "Loja";
    let empresaLogoUrl = "";
    let empresaNome = "Loja";
    if (envio.empresa_id) {
      const { data: empresa } = await supabase
        .from("empresas")
        .select("nome_fantasia, razao_social, logo_url")
        .eq("id", envio.empresa_id)
        .single();

      if (empresa) {
        fromName = empresa.nome_fantasia || empresa.razao_social || "Loja";
        empresaNome = fromName;
        empresaLogoUrl = empresa.logo_url || "";
      }
    }

    const extras = {
      empresa_nome: empresaNome,
      empresa_logo_url: empresaLogoUrl,
    };

    // Build beautiful HTML email
    const subject = replaceVariables(
      evento.assunto_email || "Atualização do seu pedido",
      envio,
      extras
    );
    const htmlBody = buildEmailHtml(evento, envio, extras);

    // Build attachments array
    const attachments = nfe_pdf_base64
      ? [{ filename: nfe_filename || "NF-e.pdf", content: nfe_pdf_base64 }]
      : undefined;

    // Send email via Resend
    const resendBody: Record<string, unknown> = {
      from: `${fromName} <${emailRemetente}>`,
      to: [envio.cliente_email],
      subject,
      html: htmlBody,
    };
    if (attachments) {
      resendBody.attachments = attachments;
    }

    console.log("Sending email from:", resendBody.from, "to:", envio.cliente_email);

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendBody),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      await supabase.from("postagem_email_log").insert({
        loja_id,
        envio_id,
        evento_id,
        destinatario: envio.cliente_email,
        assunto: subject,
        status: "failed",
        custo: 0,
      });

      throw new Error(
        `Resend API error [${resendResponse.status}]: ${JSON.stringify(resendData)}`
      );
    }

    await supabase.from("postagem_email_log").insert({
      loja_id,
      envio_id,
      evento_id,
      destinatario: envio.cliente_email,
      assunto: subject,
      status: "sent",
      custo: 0.15,
    });

    return new Response(
      JSON.stringify({ success: true, email_id: resendData.id }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error sending email:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
