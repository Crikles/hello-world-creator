import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function removeAccents(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function formatPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)\+\.]/g, "");
  if (cleaned.startsWith("55")) return cleaned;
  return "55" + cleaned;
}

const smsMessages: Record<string, (name: string, link: string) => string> = {
  "Coletado": (name, link) => `Ola ${name}. Seu CODIGO DE RASTREIO esta disponivel, acesse: [${link}] FIQUE ATENTO A SEU EMAIL.`,
  "Postado": (name, link) => `Ola ${name}. Seu CODIGO DE RASTREIO esta disponivel, acesse: [${link}] FIQUE ATENTO A SEU EMAIL.`,
  "Em Transito": (name, link) => `Ola ${name}, seu produto esta em transito. Acesse: [${link}] para acompanhar.`,
  "Centro Local": (name, link) => `Ola ${name}, seu produto esta no centro de distribuicao. Acesse: [${link}] para acompanhar.`,
  "Taxacao": (name, link) => `Ola ${name}, seu produto esta em observacao. Acesse: [${link}] e confira seu email.`,
  "Pago": (name, link) => `Ola ${name}, pagamento confirmado. Acesse: [${link}] para acompanhar a entrega.`,
  "Saiu para Entrega": (name, link) => `Ola ${name}, seu produto saiu para entrega. Acesse: [${link}] para acompanhar.`,
  "Em Rota": (name, link) => `Ola ${name}, seu produto saiu para entrega. Acesse: [${link}] para acompanhar.`,
  "Entregue": (name, link) => `Ola ${name}, seu produto foi entregue! Acesse: [${link}] para mais detalhes.`,
};

function getMessageForStatus(statusLabel: string | undefined, firstName: string, link: string): string {
  if (!statusLabel) {
    return smsMessages["Coletado"](firstName, link);
  }
  const normalizedKey = removeAccents(statusLabel);
  const msgFn = smsMessages[normalizedKey];
  if (msgFn) {
    return msgFn(firstName, link);
  }
  return `Ola ${firstName}, atualizacao do seu pedido. Acesse: [${link}] para acompanhar.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { envio_id, loja_id, status_label } = await req.json();

    if (!envio_id || !loja_id) {
      return new Response(
        JSON.stringify({ error: "envio_id and loja_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: envio, error: envioErr } = await supabase
      .from("envios")
      .select("cliente_nome, cliente_telefone, codigo_rastreio")
      .eq("id", envio_id)
      .single();

    if (envioErr || !envio) {
      return new Response(
        JSON.stringify({ error: "Envio not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!envio.cliente_telefone) {
      return new Response(
        JSON.stringify({ error: "Cliente sem telefone" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const firstName = (envio.cliente_nome || "").split(" ")[0];
    const code = envio.codigo_rastreio || "";
    const link = `https://rastreio.logisticajltransportes.com/r/${code}`;

    const message = removeAccents(getMessageForStatus(status_label, firstName, link));

    const phone = formatPhone(envio.cliente_telefone);
    const token = Deno.env.get("INTEGRAX_API_KEY")!;

    console.log("Sending SMS:", { phone, status_label, messageLength: message.length });

    const smsResponse = await fetch(
      `https://sms.aresfun.com/v1/integration/${token}/send-sms`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: [phone],
          from: "29094",
          message,
        }),
      }
    );

    const smsResult = await smsResponse.text();
    console.log("SMS API response:", smsResponse.status, smsResult);

    if (!smsResponse.ok) {
      return new Response(
        JSON.stringify({ error: "SMS API error", details: smsResult }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, phone, message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in send-sms:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
