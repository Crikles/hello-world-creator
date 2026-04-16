import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Normalizes a phone number for UAZAPI delivery.
 */
function normalizeBrazilianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  return digits;
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

    // 1. Check if whatsapp_auto_send is ON and get delay config
    const { data: config } = await supabase
      .from("postagem_config")
      .select("whatsapp_auto_send, whatsapp_msg_template, whatsapp_btn_text, whatsapp_footer, whatsapp_image_url, whatsapp_reply_text, whatsapp_btn2_text, whatsapp_btn2_url, whatsapp_delay_seconds")
      .eq("loja_id", loja_id)
      .maybeSingle();

    if (!config?.whatsapp_auto_send) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "whatsapp_auto_send is OFF" }), { status: 200 });
    }

    // 1.5. Check if there is a connected WhatsApp instance for this loja
    const { data: connectedInst } = await supabase
      .from("whatsapp_instances")
      .select("id")
      .eq("loja_id", loja_id)
      .eq("status", "connected")
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (!connectedInst) {
      console.log(`[auto-whatsapp] Skipping envio ${envio_id}: no connected instance for loja ${loja_id}`);
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "no_connected_instance" }), { status: 200 });
    }

    // 2. Check if already queued/sent for this envio (duplicate guard)
    const { data: existingLog } = await supabase
      .from("whatsapp_send_queue")
      .select("id")
      .eq("envio_id", envio_id)
      .limit(1)
      .maybeSingle();

    if (existingLog) {
      // Also check message_log
      const { data: existingMsg } = await supabase
        .from("whatsapp_message_log")
        .select("id")
        .eq("envio_id", envio_id)
        .limit(1)
        .maybeSingle();

      if (existingMsg || existingLog) {
        return new Response(JSON.stringify({ success: true, skipped: true, reason: "already_queued" }), { status: 200 });
      }
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

    // 4. Build message from template
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

    // 5. Calculate scheduled_at respecting delay
    const delaySeconds = config.whatsapp_delay_seconds || 300; // default 5 min

    // Query across ALL recent statuses (pending + sent) to avoid race conditions
    // when multiple orders arrive simultaneously
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: lastQueued } = await supabase
      .from("whatsapp_send_queue")
      .select("scheduled_at")
      .eq("loja_id", loja_id)
      .in("status", ["pending", "sent"])
      .gte("created_at", twoHoursAgo)
      .order("scheduled_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const now = new Date();
    let scheduledAt: Date;

    if (lastQueued?.scheduled_at) {
      const lastTime = new Date(lastQueued.scheduled_at).getTime();
      const nextTime = lastTime + delaySeconds * 1000;
      scheduledAt = new Date(Math.max(now.getTime(), nextTime));
    } else {
      scheduledAt = now;
    }

    // 6. Insert into queue instead of sending directly
    const { error: queueErr } = await supabase.from("whatsapp_send_queue").insert({
      envio_id,
      loja_id: loja_id,
      number,
      msg_text: imageUrl ? `\n${text}` : text,
      image_url: imageUrl,
      footer_text: footerText || null,
      choices,
      scheduled_at: scheduledAt.toISOString(),
      status: "pending",
    });

    if (queueErr) {
      console.error(`[auto-whatsapp] Failed to queue message for envio ${envio_id}:`, queueErr);
      return new Response(JSON.stringify({ error: "Failed to queue" }), { status: 500 });
    }

    console.log(`[auto-whatsapp] Queued for envio ${envio_id}, scheduled_at: ${scheduledAt.toISOString()}`);

    return new Response(JSON.stringify({ success: true, queued: true, scheduled_at: scheduledAt.toISOString() }), { status: 200 });
  } catch (error) {
    console.error("[auto-whatsapp] Error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }
});
