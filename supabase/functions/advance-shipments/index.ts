import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// deno-lint-ignore no-explicit-any
interface ProductItem {
  codigo?: number;
  nome: string;
  quantidade: number;
  valor: number;
  cfop?: string | null;
  ncm_sh?: string | null;
  cst?: string | null;
  unidade?: string | null;
}

// deno-lint-ignore no-explicit-any
function parseProductItems(envio: any): ProductItem[] {
  const raw = envio.produto || "";
  if (raw.startsWith("[")) {
    try {
      const items = JSON.parse(raw) as ProductItem[];
      if (Array.isArray(items) && items.length > 0) return items;
    } catch { /* fallthrough */ }
  }
  return [{
    codigo: 1,
    nome: raw || "Produto",
    quantidade: envio.quantidade || 1,
    valor: envio.valor || 0,
    cfop: envio.cfop,
    ncm_sh: envio.ncm_sh,
    cst: envio.cst,
    unidade: envio.unidade,
  }];
}

function formatCurrency(val: number): string {
  return val.toFixed(2).replace(".", ",");
}

function truncate(text: string, maxLen: number): string {
  if (!text) return "";
  return text.length > maxLen ? text.substring(0, maxLen - 2) + ".." : text;
}

// deno-lint-ignore no-explicit-any
async function generateDanfePdf(empresa: any, envio: any): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.CourierBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Courier);

  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);
  const lightGray = rgb(0.92, 0.92, 0.92);

  const margin = 30;
  const colWidth = width - 2 * margin;
  let y = height - margin;

  const drawText = (text: string, x: number, yPos: number, size: number, font = fontRegular, color = black) => {
    page.drawText(text || "", { x, y: yPos, size, font, color });
  };

  const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.5, color: black });
  };

  const drawRect = (x: number, yPos: number, w: number, h: number, fill = false) => {
    if (fill) {
      page.drawRectangle({ x, y: yPos, width: w, height: h, color: lightGray });
    }
    page.drawRectangle({ x, y: yPos, width: w, height: h, borderColor: black, borderWidth: 0.5 });
  };

  const drawSectionHeader = (text: string, yPos: number) => {
    drawRect(margin, yPos - 14, colWidth, 14, true);
    drawText(text, margin + 4, yPos - 11, 7, fontBold);
    return yPos - 14;
  };

  const drawLabelValue = (label: string, value: string, x: number, yPos: number, cellW: number, cellH = 24) => {
    drawRect(x, yPos - cellH, cellW, cellH);
    drawText(label, x + 3, yPos - 8, 5, fontRegular, gray);
    drawText(truncate(value, Math.floor(cellW / 4.5)), x + 3, yPos - 18, 7, fontBold);
  };

  // Data
  const now = new Date();
  const dataEmissao = `${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear()}`;
  const horaEmissao = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  const nfNumero = String(Math.floor(Math.random() * 999999) + 1).padStart(9, "0").replace(/(\d{3})(\d{3})(\d{3})/, "$1.$2.$3");
  const nfSerie = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
  const productItems = parseProductItems(envio);
  const valorTotal = productItems.reduce((sum, item) => sum + (item.valor || 0) * (item.quantidade || 1), 0);

  const endEmpresa = [empresa.endereco, empresa.numero].filter(Boolean).join(", ");
  const endEmpresa2 = [empresa.bairro, empresa.cep ? `CEP ${empresa.cep}` : ""].filter(Boolean).join(" - ");
  const endEmpresa3 = [empresa.cidade, empresa.estado].filter(Boolean).join(" - ");

  // ===== HEADER: Recebemos =====
  const recH = 30;
  drawRect(margin, y - recH, colWidth, recH);
  drawText(`Recebemos de ${empresa.razao_social || "EMPRESA"} os produtos constantes da NF-e indicada ao lado.`, margin + 4, y - 10, 6);
  drawText(`Emissao: ${dataEmissao}   Valor Total: R$ ${formatCurrency(valorTotal)}`, margin + 4, y - 20, 6);
  // NF-e box right
  const nfBoxW = 100;
  drawRect(margin + colWidth - nfBoxW, y - recH, nfBoxW, recH);
  drawText("NF-e", margin + colWidth - nfBoxW + 35, y - 10, 7, fontBold);
  drawText(`N ${nfNumero}`, margin + colWidth - nfBoxW + 10, y - 20, 6, fontBold);
  drawText(`Serie ${nfSerie}`, margin + colWidth - nfBoxW + 25, y - 28, 6, fontBold);
  y -= recH;

  // ===== HEADER PRINCIPAL =====
  const headerH = 70;
  // Left: empresa info
  const leftW = colWidth * 0.38;
  drawRect(margin, y - headerH, leftW, headerH);
  drawText(truncate(empresa.razao_social || "RAZAO SOCIAL", 30), margin + 4, y - 12, 8, fontBold);
  drawText(truncate(endEmpresa, 40), margin + 4, y - 24, 6);
  drawText(truncate(endEmpresa2, 40), margin + 4, y - 34, 6);
  drawText(truncate(endEmpresa3, 40), margin + 4, y - 44, 6);
  drawText(`Fone: ${empresa.telefone || "-"}`, margin + 4, y - 54, 6);
  drawText(truncate(empresa.email || "", 40), margin + 4, y - 64, 6);

  // Center: DANFE title
  const centerW = colWidth * 0.24;
  const centerX = margin + leftW;
  drawRect(centerX, y - headerH, centerW, headerH);
  drawText("DANFE", centerX + 20, y - 16, 14, fontBold);
  drawText("Documento Auxiliar da", centerX + 8, y - 28, 5);
  drawText("Nota Fiscal Eletronica", centerX + 6, y - 36, 5);
  drawText("1 - SAIDA", centerX + 30, y - 48, 6, fontBold);
  drawText(`N ${nfNumero}`, centerX + 10, y - 58, 6, fontBold);
  drawText(`SERIE ${nfSerie}  FOLHA 1/1`, centerX + 10, y - 66, 5);

  // Right: barcode area
  const rightW = colWidth - leftW - centerW;
  const rightX = centerX + centerW;
  drawRect(rightX, y - headerH, rightW, headerH);
  // Fake barcode
  drawRect(rightX + 10, y - 25, rightW - 20, 15, true);
  drawText("3525 0612 3456 7800 0190", rightX + 6, y - 46, 5);
  drawText("5500 1000 0000 0110 0000 0001", rightX + 6, y - 54, 5);
  drawText("www.nfe.fazenda.gov.br/portal", rightX + 10, y - 66, 5);
  y -= headerH;

  // ===== NATUREZA =====
  const natH = 24;
  const natLeftW = colWidth * 0.65;
  drawLabelValue("NATUREZA DA OPERACAO", "VENDA DE MERCADORIA ADQ. OU RECEB. DE TERCEIROS", margin, y, natLeftW, natH);
  drawLabelValue("PROTOCOLO DE AUTORIZACAO", "NFe com Autorizacao da SEFAZ", margin + natLeftW, y, colWidth - natLeftW, natH);
  y -= natH;

  // ===== INSCRICOES =====
  const insH = 24;
  const insW1 = colWidth / 3;
  drawLabelValue("INSCRICAO ESTADUAL", empresa.inscricao_estadual || "", margin, y, insW1, insH);
  drawLabelValue("INSC.EST. SUBST.TRIBUTARIA", "", margin + insW1, y, insW1, insH);
  drawLabelValue("CNPJ", empresa.cnpj || "", margin + insW1 * 2, y, colWidth - insW1 * 2, insH);
  y -= insH;

  // ===== DESTINATARIO =====
  y = drawSectionHeader("DESTINATARIO / REMETENTE", y);

  const destH = 24;
  const d1 = colWidth * 0.5;
  const d2 = colWidth * 0.3;
  drawLabelValue("NOME/RAZAO SOCIAL", envio.cliente_nome || "Cliente", margin, y, d1, destH);
  drawLabelValue("CNPJ/CPF", envio.cliente_cpf || "", margin + d1, y, d2, destH);
  drawLabelValue("DATA EMISSAO", dataEmissao, margin + d1 + d2, y, colWidth - d1 - d2, destH);
  y -= destH;

  const endStr = [envio.cliente_endereco, envio.cliente_numero].filter(Boolean).join(", ");
  const e1 = colWidth * 0.42;
  const e2 = colWidth * 0.28;
  const e3 = colWidth * 0.15;
  drawLabelValue("ENDERECO", endStr, margin, y, e1, destH);
  drawLabelValue("BAIRRO", envio.cliente_bairro || "", margin + e1, y, e2, destH);
  drawLabelValue("CEP", envio.cliente_cep || "", margin + e1 + e2, y, e3, destH);
  drawLabelValue("DATA SAIDA", dataEmissao, margin + e1 + e2 + e3, y, colWidth - e1 - e2 - e3, destH);
  y -= destH;

  const m1 = colWidth * 0.3;
  const m2 = colWidth * 0.2;
  const m3 = colWidth * 0.1;
  drawLabelValue("MUNICIPIO", envio.cliente_cidade || "", margin, y, m1, destH);
  drawLabelValue("FONE", envio.cliente_telefone || "", margin + m1, y, m2, destH);
  drawLabelValue("UF", envio.cliente_estado || "", margin + m1 + m2, y, m3, destH);
  drawLabelValue("INSC.ESTADUAL", "", margin + m1 + m2 + m3, y, colWidth * 0.2, destH);
  drawLabelValue("HORA SAIDA", horaEmissao, margin + m1 + m2 + m3 + colWidth * 0.2, y, colWidth - m1 - m2 - m3 - colWidth * 0.2, destH);
  y -= destH;

  // ===== CALCULO DO IMPOSTO =====
  y = drawSectionHeader("CALCULO DO IMPOSTO", y);
  const taxH = 24;
  const tw = colWidth / 5;
  drawLabelValue("BASE CALC. ICMS", "0,00", margin, y, tw, taxH);
  drawLabelValue("VALOR DO ICMS", "0,00", margin + tw, y, tw, taxH);
  drawLabelValue("BASE CALC. ICMS ST", "0,00", margin + tw * 2, y, tw, taxH);
  drawLabelValue("VALOR DO ICMS ST", "0,00", margin + tw * 3, y, tw, taxH);
  drawLabelValue("VALOR TOTAL PRODUTOS", `R$ ${formatCurrency(valorTotal)}`, margin + tw * 4, y, colWidth - tw * 4, taxH);
  y -= taxH;

  drawLabelValue("VALOR DO FRETE", "0,00", margin, y, tw, taxH);
  drawLabelValue("VALOR DO SEGURO", "0,00", margin + tw, y, tw, taxH);
  drawLabelValue("DESCONTO", "0,00", margin + tw * 2, y, tw, taxH);
  drawLabelValue("OUTRAS DESP.", "0,00", margin + tw * 3, y, tw, taxH);
  drawLabelValue("VALOR TOTAL DA NOTA", `R$ ${formatCurrency(valorTotal)}`, margin + tw * 4, y, colWidth - tw * 4, taxH);
  y -= taxH;

  // ===== TRANSPORTADOR =====
  y = drawSectionHeader("TRANSPORTADOR / VOLUMES", y);
  const trH = 24;
  const tr1 = colWidth * 0.3;
  const tr2 = colWidth * 0.2;
  drawLabelValue("RAZAO SOCIAL", "JL Transportes de Cargas LTDA", margin, y, tr1, trH);
  drawLabelValue("FRETE POR CONTA", "0 - REMETENTE", margin + tr1, y, tr2, trH);
  drawLabelValue("PLACA", "FOD9C97", margin + tr1 + tr2, y, colWidth * 0.15, trH);
  drawLabelValue("UF", "SP", margin + tr1 + tr2 + colWidth * 0.15, y, colWidth * 0.1, trH);
  drawLabelValue("CNPJ", "00.320.378/0001-72", margin + tr1 + tr2 + colWidth * 0.25, y, colWidth - tr1 - tr2 - colWidth * 0.25, trH);
  y -= trH;

  // ===== PRODUTOS =====
  y = drawSectionHeader("DADOS DOS PRODUTOS / SERVICOS", y);

  // Product header
  const prodH = 14;
  const cols = [
    { label: "COD", w: colWidth * 0.08 },
    { label: "DESCRICAO DO PRODUTO", w: colWidth * 0.32 },
    { label: "NCM/SH", w: colWidth * 0.12 },
    { label: "CFOP", w: colWidth * 0.1 },
    { label: "UN", w: colWidth * 0.08 },
    { label: "VL.UNIT", w: colWidth * 0.15 },
    { label: "VL.TOTAL", w: colWidth * 0.15 },
  ];

  let cx = margin;
  for (const col of cols) {
    drawRect(cx, y - prodH, col.w, prodH, true);
    drawText(col.label, cx + 2, y - 10, 5, fontBold);
    cx += col.w;
  }
  y -= prodH;

  // Product rows
  for (const item of productItems) {
    const rowH = 16;
    if (y - rowH < margin + 80) break; // Don't overflow page

    const itemQty = item.quantidade || 1;
    const itemUnit = item.valor || 0;
    const itemTotal = itemUnit * itemQty;

    cx = margin;
    const vals = [
      String(item.codigo || 1),
      truncate(item.nome || "Produto", 35),
      item.ncm_sh || "00000000",
      item.cfop || "5102",
      item.unidade || "UN",
      `R$ ${formatCurrency(itemUnit)}`,
      `R$ ${formatCurrency(itemTotal)}`,
    ];

    for (let i = 0; i < cols.length; i++) {
      drawRect(cx, y - rowH, cols[i].w, rowH);
      drawText(vals[i], cx + 2, y - 11, 6, i === 6 ? fontBold : fontRegular);
      cx += cols[i].w;
    }
    y -= rowH;
  }

  // ===== DADOS ADICIONAIS =====
  y = drawSectionHeader("DADOS ADICIONAIS", y);
  const addH = 40;
  const addLeftW = colWidth * 0.6;
  drawRect(margin, y - addH, addLeftW, addH);
  drawText("INFORMACOES COMPLEMENTARES", margin + 4, y - 10, 5, fontBold, gray);
  drawText("Documento emitido por ME ou EPP optante pelo", margin + 4, y - 22, 5);
  drawText("Simples Nacional. Nao gera direito a credito de IPI.", margin + 4, y - 30, 5);
  drawRect(margin + addLeftW, y - addH, colWidth - addLeftW, addH);
  drawText("RESERVADO AO FISCO", margin + addLeftW + 4, y - 10, 5, fontBold, gray);
  y -= addH;

  // Footer
  drawText(`DATA E HORA DA IMPRESSAO: ${dataEmissao} ${horaEmissao}`, margin + colWidth - 200, y - 12, 5);

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const now = new Date().toISOString();
  let totalProcessed = 0;
  const MAX_PER_RUN = 50;

  try {
    // Fetch all stores with postagem config
    const { data: configs, error: cfgErr } = await supabase
      .from("postagem_config")
      .select("*, lojas!postagem_config_loja_id_fkey(id, user_id)")
      .not("template_ativo_id", "is", null);

    if (cfgErr || !configs) {
      console.error("Failed to fetch configs:", cfgErr);
      return new Response(JSON.stringify({ error: "Failed to fetch configs" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const config of configs) {
      if (totalProcessed >= MAX_PER_RUN) break;

      const lojaId = config.loja_id;
      // deno-lint-ignore no-explicit-any
      const lojaUserId = (config as any).lojas?.user_id;
      if (!lojaUserId) continue;

      // Fetch template events
      const { data: allEvents } = await supabase
        .from("postagem_eventos")
        .select("*")
        .eq("template_id", config.template_ativo_id)
        .order("ordem", { ascending: true });

      if (!allEvents || allEvents.length === 0) continue;

      // Fetch global costs
      const { data: costs } = await supabase
        .from("system_config")
        .select("key, value");

      const costMap: Record<string, number> = {};
      if (costs) for (const c of costs) costMap[c.key] = Number(c.value);

      // Apply custom per-user prices if configured
      const { data: profileData } = await supabase
        .from("profiles")
        .select("custom_prices")
        .eq("id", lojaUserId)
        .single();

      // deno-lint-ignore no-explicit-any
      const customPrices = (profileData?.custom_prices as Record<string, any>) || {};
      for (const [key, val] of Object.entries(customPrices)) {
        if (val !== undefined && val !== null) {
          costMap[key] = Number(val);
        }
      }

      // --- 1. AUTO-START: new shipments if auto_envio is enabled ---
      // deno-lint-ignore no-explicit-any
      if ((config as any).auto_envio) {
        const { data: pending } = await supabase
          .from("envios")
          .select("id")
          .eq("loja_id", lojaId)
          .eq("status", "pendente")
          .eq("ultimo_evento_ordem", 0)
          .is("deleted_at", null)
          .limit(MAX_PER_RUN - totalProcessed);

        if (pending) {
          for (const envio of pending) {
            if (totalProcessed >= MAX_PER_RUN) break;
            const result = await advanceShipment(
              supabase, envio.id, lojaId, lojaUserId, config, allEvents, costMap
            );
            if (result) totalProcessed++;
          }
        }
      }

      // --- 2. ADVANCE: shipments where delay has expired ---
      if (totalProcessed >= MAX_PER_RUN) break;

      const { data: eligible } = await supabase
        .from("envios")
        .select("id, ultimo_evento_ordem, proximo_avanco_em")
        .eq("loja_id", lojaId)
        .neq("status", "entregue")
        .gt("ultimo_evento_ordem", 0)
        .is("deleted_at", null)
        .limit(MAX_PER_RUN - totalProcessed);

      if (eligible) {
        for (const envio of eligible) {
          if (totalProcessed >= MAX_PER_RUN) break;
          // deno-lint-ignore no-explicit-any
          const pa = (envio as any).proximo_avanco_em;
          if (pa && new Date(pa) > new Date()) continue;

          const result = await advanceShipment(
            supabase, envio.id, lojaId, lojaUserId, config, allEvents, costMap
          );
          if (result) totalProcessed++;
        }
      }
    }

    console.log(`Cron complete: processed ${totalProcessed} shipments`);
    return new Response(
      JSON.stringify({ success: true, processed: totalProcessed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Cron error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// deno-lint-ignore no-explicit-any
async function advanceShipment(
  supabase: any,
  envioId: string,
  lojaId: string,
  lojaUserId: string,
  // deno-lint-ignore no-explicit-any
  config: any,
  // deno-lint-ignore no-explicit-any
  allEvents: any[],
  costMap: Record<string, number>
): Promise<boolean> {
  try {
    const { data: shipment, error: sErr } = await supabase
      .from("envios")
      .select("*, empresas(*)")
      .eq("id", envioId)
      .single();

    if (sErr || !shipment) return false;

    const currentOrdem = shipment.ultimo_evento_ordem ?? 0;
    // deno-lint-ignore no-explicit-any
    const nextEvent = allEvents.find((e: any) => e.ordem > currentOrdem);
    if (!nextEvent) return false;

    // Debit credits on first event
    if (currentOrdem === 0) {
      let total = 0;
      const activeServices: string[] = [];

      if (config.enviar_nfe_email && costMap["custo_nfe_email"]) {
        total += costMap["custo_nfe_email"];
        activeServices.push("NF-e");
      }
      if (config.enviar_emails && costMap["custo_email_rastreio"]) {
        total += costMap["custo_email_rastreio"];
        activeServices.push("E-mail");
      }
      if (config.ativar_taxacao && costMap["custo_taxacao"]) {
        total += costMap["custo_taxacao"];
        activeServices.push("Taxacao");
      }

      if (total > 0) {
        const descricao = `Envio processado (${activeServices.join(", ")})`;
        const { data: debitOk, error: debitErr } = await supabase.rpc("debit_user_credits", {
          _user_id: lojaUserId,
          _quantidade: total,
          _descricao: descricao,
        });

        if (debitErr || !debitOk) {
          console.warn(`Insufficient balance for user ${lojaUserId}, skipping envio ${envioId}`);
          return false;
        }
        console.log(`Debited ${total} credits for envio ${envioId}`);
      }
    }

    // Determine new status
    const totalEvents = allEvents.length;
    const eventIndex = allEvents.indexOf(nextEvent);
    let newStatus: string;

    if (eventIndex === totalEvents - 1) {
      newStatus = "entregue";
    } else if (eventIndex === totalEvents - 2) {
      newStatus = "saiu_para_entrega";
    } else {
      newStatus = "em_transito";
    }

    // Calculate next advance time
    // deno-lint-ignore no-explicit-any
    const followingEvent = allEvents.find((e: any) => e.ordem > nextEvent.ordem);
    const proximoAvancoEm = followingEvent && followingEvent.delay_horas > 0
      ? new Date(Date.now() + followingEvent.delay_horas * 3600000).toISOString()
      : null;

    // Update envio
    const { error: uErr } = await supabase
      .from("envios")
      .update({
        ultimo_evento_ordem: nextEvent.ordem,
        status: newStatus,
        status_label: nextEvent.status_label,
        proximo_avanco_em: proximoAvancoEm,
      })
      .eq("id", envioId);

    if (uErr) {
      console.error(`Failed to update envio ${envioId}:`, uErr);
      return false;
    }

    // Check if this event should send email
    let isAtivo = false;
    if (nextEvent.enviar_nfe_pdf) {
      isAtivo = config.enviar_nfe_email;
    } else if (nextEvent.status_label === "Taxacao" || nextEvent.status_label === "Pago" || nextEvent.status_label === "Taxação") {
      isAtivo = config.ativar_taxacao;
    } else {
      isAtivo = config.enviar_emails;
    }

    // Generate and upload NF-e PDF if needed (server-side with pdf-lib)
    let nfe_storage_path = "";
    let nfe_filename = "";

    if (nextEvent.enviar_nfe_pdf && shipment.empresas) {
      try {
        const pdfBytes = await generateDanfePdf(shipment.empresas, shipment);
        nfe_filename = `DANFE_${Math.floor(Math.random() * 9000000000 + 1000000000)}.pdf`;
        const storagePath = `${envioId}/${nfe_filename}`;

        const { error: uploadErr } = await supabase.storage
          .from("nfe-pdfs")
          .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: true });

        if (uploadErr) {
          console.error(`PDF upload failed for envio ${envioId}:`, uploadErr);
        } else {
          nfe_storage_path = storagePath;
          console.log(`PDF generated and uploaded server-side: ${storagePath}`);
        }
      } catch (pdfErr) {
        console.error(`PDF generation failed for envio ${envioId}:`, pdfErr);
      }
    }

    // Send email
    if (isAtivo && nextEvent.enviar_email) {
      console.log(`Sending email for envio ${envioId}, event: ${nextEvent.nome}`);
      const { error: funcErr } = await supabase.functions.invoke("send-email", {
        body: {
          envio_id: envioId,
          evento_id: nextEvent.id,
          loja_id: lojaId,
          nfe_storage_path,
          nfe_filename,
        },
      });
      if (funcErr) {
        console.error(`Email failed for envio ${envioId}:`, funcErr);
      }
    }

    // SMS dispatch
    if (
      config.ativar_site_rastreio &&
      shipment.cliente_telefone &&
      !nextEvent.enviar_nfe_pdf
    ) {
      const smsCost = costMap["custo_sms_rastreio"] || 0;
      let canSendSms = true;

      if (smsCost > 0) {
        const { data: smsDebitOk, error: smsDebitErr } = await supabase.rpc("debit_user_credits", {
          _user_id: lojaUserId,
          _quantidade: smsCost,
          _descricao: `SMS enviado - ${nextEvent.status_label}`,
        });

        if (smsDebitErr || !smsDebitOk) {
          canSendSms = false;
        }
      }

      if (canSendSms) {
        const { error: smsErr } = await supabase.functions.invoke("send-sms", {
          body: { envio_id: envioId, loja_id: lojaId, status_label: nextEvent.status_label },
        });
        if (smsErr) console.error(`SMS failed for envio ${envioId}:`, smsErr);
      }
    }

    console.log(`Advanced envio ${envioId} -> ${nextEvent.status_label} (${newStatus})`);
    return true;
  } catch (err) {
    console.error(`Error advancing envio ${envioId}:`, err);
    return false;
  }
}
