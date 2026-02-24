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
}

function replaceVariables(
  text: string,
  envio: Record<string, unknown>
): string {
  return text
    .replace(/\{\{cliente_nome\}\}/g, (envio.cliente_nome as string) || "")
    .replace(/\{\{cliente_email\}\}/g, (envio.cliente_email as string) || "")
    .replace(/\{\{produto\}\}/g, (envio.produto as string) || "")
    .replace(
      /\{\{codigo_rastreio\}\}/g,
      (envio.codigo_rastreio as string) || ""
    )
    .replace(
      /\{\{transportadora\}\}/g,
      (envio.transportadora as string) || ""
    )
    .replace(/\{\{valor\}\}/g, String(envio.valor || "0"))
    .replace(/\{\{quantidade\}\}/g, String(envio.quantidade || "1"));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    )!;

    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify user
    const anonClient = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsError } =
      await anonClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { envio_id, evento_id, loja_id } =
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

    // Fetch empresa data for "from" name
    let fromName = "Loja";
    if (envio.empresa_id) {
      const { data: empresa } = await supabase
        .from("empresas")
        .select("nome_fantasia, razao_social")
        .eq("id", envio.empresa_id)
        .single();

      if (empresa) {
        fromName = empresa.nome_fantasia || empresa.razao_social || "Loja";
      }
    }

    // Replace template variables
    const subject = replaceVariables(
      evento.assunto_email || "Atualização do seu pedido",
      envio
    );
    const htmlBody = replaceVariables(evento.corpo_email || "", envio);

    // Send email via Resend
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <onboarding@resend.dev>`,
        to: [envio.cliente_email],
        subject,
        html: htmlBody,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      // Log failed attempt
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

    // Log successful send
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
