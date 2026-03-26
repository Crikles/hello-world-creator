import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const UAZAPI_BASE = "https://rushsend.uazapi.com";

/**
 * Normalizes a phone number for UAZAPI delivery.
 */
function normalizeBrazilianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  return digits;
}

/** Check real instance status via UAZAPI API */
async function checkInstanceStatus(token: string): Promise<string> {
  try {
    const res = await fetch(`${UAZAPI_BASE}/instance/status`, {
      method: "GET",
      headers: { Accept: "application/json", token },
    });
    const data = await res.json();
    return data.instance?.status || data.status || data.state || "disconnected";
  } catch {
    return "disconnected";
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const { envio_id, loja_id } = await req.json();
    if (!envio_id || !loja_id) {
      return new Response(JSON.stringify({ error: "Missing envio_id or loja_id" }), { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Check if whatsapp_auto_send is ON
    const { data: config } = await supabase
      .from("postagem_config")
      .select("whatsapp_auto_send, whatsapp_msg_template, whatsapp_btn_text, whatsapp_footer, whatsapp_image_url, whatsapp_reply_text, whatsapp_btn2_text, whatsapp_btn2_url")
      .eq("loja_id", loja_id)
      .maybeSingle();

    if (!config?.whatsapp_auto_send) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "whatsapp_auto_send is OFF" }), { status: 200 });
    }

    // 2. Check if already sent for this envio (duplicate guard)
    const { data: existingLog } = await supabase
      .from("whatsapp_message_log")
      .select("id")
      .eq("envio_id", envio_id)
      .limit(1)
      .maybeSingle();

    if (existingLog) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "already_sent" }), { status: 200 });
    }

    // 3. Fetch envio data
    const { data: envio } = await supabase
      .from("envios")
      .select("cliente_nome, cliente_telefone, produto, valor, codigo_rastreio")
      .eq("id", envio_id)
      .single();

    if (!envio || !envio.cliente_telefone) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "no_phone" }), { status: 200 });
    }

    // 4. Fetch connected instances with active subscriptions
    const ADMIN_TOKEN = Deno.env.get("UAZAPI_ADMIN_TOKEN");
    if (!ADMIN_TOKEN) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "no_uazapi_token" }), { status: 200 });
    }

    const { data: waInstances } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("loja_id", loja_id)
      .eq("status", "connected");

    const activeInstances = (waInstances || []).filter(
      (i: any) => i.expires_at && new Date(i.expires_at) > new Date()
    );

    if (activeInstances.length === 0) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "no_active_instances" }), { status: 200 });
    }

    // 5. Validate instance status via API and filter out disconnected ones
    const verifiedInstances: any[] = [];
    for (const inst of activeInstances) {
      const realStatus = await checkInstanceStatus(inst.instance_token);
      if (realStatus === "connected") {
        verifiedInstances.push(inst);
      } else {
        // Update stale status in DB
        await supabase
          .from("whatsapp_instances")
          .update({ status: realStatus, updated_at: new Date().toISOString() })
          .eq("id", inst.id);
        console.log(`[auto-whatsapp] Instance ${inst.instance_name} is ${realStatus}, removed from rotation`);
      }
    }

    if (verifiedInstances.length === 0) {
      // Log the failure with reason
      await supabase.from("whatsapp_message_log").insert({
        envio_id,
        loja_id,
        status: "failed",
        error_reason: "Todas as instâncias estão desconectadas",
        http_status: 0,
      });
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "all_instances_disconnected" }), { status: 200 });
    }

    // Round-robin: pick random verified instance
    const inst = verifiedInstances[Math.floor(Math.random() * verifiedInstances.length)];

    // 6. Build message from template
    let produtoNome = envio.produto;
    try {
      const parsed = JSON.parse(envio.produto);
      if (Array.isArray(parsed)) produtoNome = parsed.map((p: any) => p.nome).join(", ");
    } catch { /* not JSON */ }

    const msgTemplate = config.whatsapp_msg_template || "Olá {{nome}}! Seu pedido foi atualizado.";
    const text = msgTemplate
      .replace(/\{\{nome\}\}/g, envio.cliente_nome || "")
      .replace(/\{\{produto\}\}/g, produtoNome)
      .replace(/\{\{valor\}\}/g, Number(envio.valor || 0).toFixed(2))
      .replace(/\{\{codigo_rastreio\}\}/g, envio.codigo_rastreio || "");

    const number = normalizeBrazilianPhone(envio.cliente_telefone);

    const btnText = config.whatsapp_btn_text || "📦 Rastrear Pedido";
    const trackingUrl = `${supabaseUrl}/functions/v1/redirect?c=${envio.codigo_rastreio || ""}`;
    const footerText = config.whatsapp_footer || "";
    const imageUrl = config.whatsapp_image_url || null;
    const replyText = config.whatsapp_reply_text || null;
    const btn2Text = config.whatsapp_btn2_text || null;
    const btn2Url = config.whatsapp_btn2_url || null;

    const choices: string[] = [];
    if (btnText && trackingUrl) choices.push(`${btnText}|${trackingUrl}`);
    if (btn2Text && btn2Url) choices.push(`${btn2Text}|${btn2Url}`);
    if (replyText) choices.push(replyText);

    const sendBody: Record<string, unknown> = {
      number,
      type: "button",
      text: imageUrl ? `\n${text}` : text,
      choices,
    };
    if (imageUrl) sendBody.imageButton = imageUrl;
    if (footerText) sendBody.footerText = footerText;

    // 7. Send via UAZAPI
    const res = await fetch(`${UAZAPI_BASE}/send/menu`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        token: inst.instance_token,
      },
      body: JSON.stringify(sendBody),
    });

    const resBody = await res.json();
    const waStatus = res.ok ? "sent" : "failed";
    const errorReason = res.ok ? null : (resBody?.message || resBody?.error || JSON.stringify(resBody).slice(0, 200));

    // 8. Log message with error details
    await supabase.from("whatsapp_message_log").insert({
      envio_id,
      loja_id,
      instance_id: inst.id,
      status: waStatus,
      error_reason: errorReason,
      provider_response: resBody,
      http_status: res.status,
    });

    console.log(`[auto-whatsapp] ${waStatus} for envio ${envio_id} via ${inst.instance_name}${errorReason ? ` | reason: ${errorReason}` : ""}`);

    return new Response(JSON.stringify({ success: true, status: waStatus }), { status: 200 });
  } catch (error) {
    console.error("[auto-whatsapp] Error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }
});
