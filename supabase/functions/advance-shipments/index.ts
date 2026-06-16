import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const NCM_CODES = ["61091000","62046200","64041900","85171200","84713012","33049910","42021200","42029200","71171900","96032100","39241000","85167100","94036000","49019900","85234990","62034200","61102000","85044090","90049090","95030090"];
const CST_CODES = ["102","101","103","202","300","400","500","900","000","010","020","041","060"];
function hashCode(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; } return h; }
function getRandomNcm(seed?: string): string { const i = seed ? Math.abs(hashCode(seed)) % NCM_CODES.length : Math.floor(Math.random() * NCM_CODES.length); return NCM_CODES[i]; }
function getRandomCst(seed?: string): string { const i = seed ? Math.abs(hashCode(seed + "_cst")) % CST_CODES.length : Math.floor(Math.random() * CST_CODES.length); return CST_CODES[i]; }

function normalizeBrazilianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  return digits;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const UAZAPI_BASE = "https://rushsend.uazapi.com";

// Per-loja WhatsApp instance rotation counter (resets each cron run)
const whatsappCounters: Record<string, number> = {};

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
      if (Array.isArray(items) && items.length > 0) {
        // Distribute envio.valor if items lack individual valor
        const hasAnyValor = items.some(i => i.valor && i.valor > 0);
        if (!hasAnyValor && envio.valor && envio.valor > 0) {
          const totalQty = items.reduce((s, i) => s + (i.quantidade || 1), 0);
          items.forEach(i => { i.valor = envio.valor / totalQty; });
        }
        // Inherit fiscal fields
        items.forEach((i, idx) => {
          const seed = `${envio.id || ""}${idx}`;
          if (!i.cfop) i.cfop = envio.cfop || "5102";
          if (!i.ncm_sh) i.ncm_sh = envio.ncm_sh || getRandomNcm(seed);
          if (!i.cst) i.cst = envio.cst || getRandomCst(seed);
          if (!i.unidade) i.unidade = envio.unidade;
        });
        return items;
      }
    } catch { /* fallthrough */ }
  }
  const seed = envio.id || "default";
  return [{
    codigo: 1,
    nome: raw || "Produto",
    quantidade: envio.quantidade || 1,
    valor: envio.valor || 0,
    cfop: envio.cfop || "5102",
    ncm_sh: envio.ncm_sh || getRandomNcm(seed),
    cst: envio.cst || getRandomCst(seed),
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

function toPdfSafeText(text: string): string {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "");
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
    page.drawText(toPdfSafeText(text), { x, y: yPos, size, font, color });
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
  drawLabelValue("RAZAO SOCIAL", "HOLDING Transportes de Cargas LTDA", margin, y, tr1, trH);
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
  for (const [idx, item] of productItems.entries()) {
    const rowH = 16;
    if (y - rowH < margin + 80) break; // Don't overflow page

    const itemQty = item.quantidade || 1;
    const itemUnit = item.valor || 0;
    const itemTotal = itemUnit * itemQty;

    cx = margin;
    const vals = [
      String(item.codigo || 1),
      truncate(item.nome || "Produto", 35),
      item.ncm_sh || getRandomNcm(String(idx)),
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

  let targetLojaId: string | null = null;
  let targetEnvioId: string | null = null;
  try {
    if (req.method !== "GET") {
      const body = await req.json().catch(() => ({}));
      targetLojaId = typeof body?.loja_id === "string" ? body.loja_id : null;
      targetEnvioId = typeof body?.envio_id === "string" ? body.envio_id : null;
    }
  } catch {
    targetLojaId = null;
    targetEnvioId = null;
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const now = new Date().toISOString();
  let totalProcessed = 0;
  const MAX_PER_RUN = 500;
  const MAX_PER_LOJA = 300;
  const BATCH_DELAY_MS = 1500; // delay between each shipment to avoid Functions rate limit

  try {
    // Fetch all stores with postagem config
    let configQuery = supabase
      .from("postagem_config")
      .select("*, lojas!postagem_config_loja_id_fkey(id, user_id)")
      .not("template_ativo_id", "is", null);

    if (targetLojaId) {
      configQuery = configQuery.eq("loja_id", targetLojaId);
    }

    const { data: configs, error: cfgErr } = await configQuery;

    if (cfgErr || !configs) {
      console.error("Failed to fetch configs:", cfgErr);
      return new Response(JSON.stringify({ error: "Failed to fetch configs" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pre-fetch active loja_ids to skip blocked/inactive accounts (otimização Cloud)
    const allLojaIds = configs.map(c => c.loja_id).filter(Boolean);
    const activeLojaIds = new Set<string>();
    if (allLojaIds.length > 0 && !targetLojaId) {
      const { data: recentEnvios } = await supabase
        .from("envios")
        .select("loja_id")
        .in("loja_id", allLojaIds)
        .is("deleted_at", null)
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .limit(10000);
      (recentEnvios || []).forEach((e: any) => e.loja_id && activeLojaIds.add(e.loja_id));

      // Excluir contas bloqueadas
      const userIds = Array.from(new Set(configs.map((c: any) => c.lojas?.user_id).filter(Boolean)));
      if (userIds.length > 0) {
        const { data: blockedProfiles } = await supabase
          .from("profiles")
          .select("id")
          .in("id", userIds)
          .eq("blocked", true);
        const blockedUserIds = new Set((blockedProfiles || []).map((p: any) => p.id));
        configs.forEach((c: any) => {
          if (blockedUserIds.has(c.lojas?.user_id)) activeLojaIds.delete(c.loja_id);
        });
      }
      console.log(`[advance-shipments] Filtragem: ${configs.length} lojas configuradas, ${activeLojaIds.size} ativas (últimos 30d, não bloqueadas)`);
    }

    for (const config of configs) {
      if (totalProcessed >= MAX_PER_RUN) break;

      const lojaId = config.loja_id;
      // deno-lint-ignore no-explicit-any
      const lojaUserId = (config as any).lojas?.user_id;
      if (!lojaUserId) continue;

      // Pular lojas inativas/bloqueadas (otimização Cloud)
      if (!targetLojaId && !activeLojaIds.has(lojaId)) {
        continue;
      }

      // Initialize a cache for template events for this cron run
      const templateEventsCache: Record<string, any[]> = {};


      // (filtros de eventos por nome são aplicados dentro de advanceShipment)



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
      // Strict check: only start new shipments when explicitly true (not null/undefined)
      // deno-lint-ignore no-explicit-any
      if ((config as any).auto_envio === true) {
        let pendingQuery = supabase
          .from("envios")
          .select("id")
          .eq("loja_id", lojaId)
          .eq("status", "pendente")
          .eq("ultimo_evento_ordem", 0)
          .is("deleted_at", null)
          .order("created_at", { ascending: true })
          .limit(Math.min(MAX_PER_LOJA, MAX_PER_RUN - totalProcessed));

        if (targetEnvioId) {
          pendingQuery = pendingQuery.eq("id", targetEnvioId).limit(1);
        }

        const { data: pending } = await pendingQuery;

        if (pending && pending.length > 0) {
          for (const envio of pending) {
            if (totalProcessed >= MAX_PER_RUN) break;
            try {
              const success = await advanceShipment(supabase, envio.id, lojaId, lojaUserId, config, costMap, templateEventsCache);
              if (success) totalProcessed++;
            } catch (e) {
              console.error(`Error advancing pending ${envio.id}:`, e);
            }
            await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
          }
        }
      }

      // --- 2. ADVANCE: shipments where delay has expired ---
      // O toggle AUTO controla apenas o DISPARO INICIAL (etapa 0 -> 1).
      // Pedidos já iniciados (manual ou auto) devem SEMPRE seguir o fluxo
      // automaticamente conforme os delays configurados em Postagens, mesmo
      // que o AUTO esteja desligado. Pausas manuais (Falha/Taxação/Pago/Entregue)
      // continuam sendo respeitadas dentro de advanceShipment().
      if (targetEnvioId) continue;
      if (totalProcessed >= MAX_PER_RUN) break;

      const lojaLimit = Math.min(MAX_PER_LOJA, MAX_PER_RUN - totalProcessed);

      const { data: eligible } = await supabase
        .from("envios")
        .select("id, ultimo_evento_ordem, proximo_avanco_em, status_label")
        .eq("loja_id", lojaId)
        .neq("status", "entregue")
        .neq("status", "saiu_para_entrega") // evento "Entregue" requer confirmação manual
        .gt("ultimo_evento_ordem", 0)
        .is("deleted_at", null)
        // Pause é decidida em advanceShipment() via nome do próximo evento
        .or(`proximo_avanco_em.is.null,proximo_avanco_em.lte.${now}`)
        .order("created_at", { ascending: true })
        .limit(lojaLimit);

      if (eligible && eligible.length > 0) {
        for (const envio of eligible) {
          if (totalProcessed >= MAX_PER_RUN) break;
          try {
            const success = await advanceShipment(supabase, envio.id, lojaId, lojaUserId, config, costMap, templateEventsCache);
            if (success) totalProcessed++;
          } catch (e) {
            console.error(`Error advancing eligible ${envio.id}:`, e);
          }
          await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
        }
      }
    }

    // ── 3. PROCESS WHATSAPP SEND QUEUE (1 per loja per cron cycle) ──
    let queueProcessed = 0;
    const QUEUE_BATCH = 100;
    try {
      const { data: queueItems } = await supabase
        .from("whatsapp_send_queue")
        .select("*")
        .eq("status", "pending")
        .lte("scheduled_at", now)
        .order("scheduled_at", { ascending: true })
        .limit(QUEUE_BATCH);

      if (queueItems && queueItems.length > 0) {
        // Group by loja_id and pick only the FIRST (oldest scheduled_at) per loja
        const firstPerLoja = new Map<string, typeof queueItems[0]>();
        for (const item of queueItems) {
          if (!firstPerLoja.has(item.loja_id)) {
            firstPerLoja.set(item.loja_id, item);
          }
        }
        const itemsToProcess = Array.from(firstPerLoja.values());
        console.log(`Queue: ${queueItems.length} pending items, processing ${itemsToProcess.length} (1 per loja)`);

        for (const item of itemsToProcess) {
          try {
            const nowIso = new Date().toISOString();
            let inst: {
              instance_token: string;
              instance_name: string;
              id: string;
              expires_at: string;
              loja_id?: string;
            } | null = null;

            if (item.instance_id) {
              const { data: selectedInst } = await supabase
                .from("whatsapp_instances")
                .select("instance_token, instance_name, id, expires_at, loja_id")
                .eq("id", item.instance_id)
                .maybeSingle();
              inst = selectedInst;
            }

            if (!inst || !inst.instance_token || !inst.expires_at || new Date(inst.expires_at) < new Date()) {
              // Try fallback with ROUND-ROBIN rotation: find all connected instances,
              // then pick the one that was used least recently (or never used) for this loja.
              const { data: connectedInsts } = await supabase
                .from("whatsapp_instances")
                .select("instance_token, instance_name, id, expires_at, loja_id, created_at")
                .eq("loja_id", item.loja_id)
                .eq("status", "connected")
                .gt("expires_at", nowIso)
                .order("created_at", { ascending: true });

              let fallback: typeof inst = null;
              if (connectedInsts && connectedInsts.length > 0) {
                // Get last-used timestamp per instance from message log
                const ids = connectedInsts.map((i: any) => i.id);
                const { data: lastUsed } = await supabase
                  .from("whatsapp_message_log")
                  .select("instance_id, created_at")
                  .eq("loja_id", item.loja_id)
                  .in("instance_id", ids)
                  .order("created_at", { ascending: false })
                  .limit(200);

                const lastUsedMap = new Map<string, string>();
                for (const row of (lastUsed || [])) {
                  if (row.instance_id && !lastUsedMap.has(row.instance_id)) {
                    lastUsedMap.set(row.instance_id, row.created_at);
                  }
                }

                // Sort: never-used first, then oldest-used first
                const sorted = [...connectedInsts].sort((a: any, b: any) => {
                  const aUsed = lastUsedMap.get(a.id);
                  const bUsed = lastUsedMap.get(b.id);
                  if (!aUsed && !bUsed) return 0;
                  if (!aUsed) return -1;
                  if (!bUsed) return 1;
                  return new Date(aUsed).getTime() - new Date(bUsed).getTime();
                });
                fallback = sorted[0];
                console.log(`[rotation] loja=${item.loja_id} picked instance=${fallback?.id} (least-recently-used among ${connectedInsts.length})`);
              }
              if (!fallback) {
                const reason = item.instance_id
                  ? (!inst ? "Instância não encontrada" : "Instância expirada")
                  : "Nenhuma instância conectada";
                await supabase
                  .from("whatsapp_send_queue")
                  .update({ status: "failed", processed_at: nowIso, error_reason: reason, http_status: 0 })
                  .eq("id", item.id);
                continue;
              }

              inst = fallback;

              if (item.instance_id !== inst.id) {
                await supabase
                  .from("whatsapp_send_queue")
                  .update({ instance_id: inst.id })
                  .eq("id", item.id);
              }
            }

            // Validate real instance status via UAZAPI API
            let realStatus = "connected";
            try {
              const statusRes = await fetch(`${UAZAPI_BASE}/instance/status`, {
                method: "GET",
                headers: { Accept: "application/json", token: inst!.instance_token },
              });
              const statusData = await statusRes.json();
              realStatus = statusData.instance?.status || statusData.status || statusData.state || "disconnected";
            } catch { realStatus = "disconnected"; }

            if (realStatus !== "connected") {
              // Update DB status
              await supabase
                .from("whatsapp_instances")
                .update({ status: realStatus, updated_at: new Date().toISOString() })
                .eq("id", inst!.id);

              // Try another instance
              const { data: altInsts } = await supabase
                .from("whatsapp_instances")
                .select("instance_token, instance_name, id, expires_at, loja_id")
                .eq("loja_id", item.loja_id)
                .eq("status", "connected")
                .neq("id", inst!.id)
                .gt("expires_at", new Date().toISOString());

              if (!altInsts || altInsts.length === 0) {
                const reason = `Instância ${inst!.instance_name} está ${realStatus}`;
                await supabase
                  .from("whatsapp_send_queue")
                  .update({ status: "failed", processed_at: new Date().toISOString(), error_reason: reason, http_status: 0 })
                  .eq("id", item.id);
                await supabase.from("whatsapp_message_log").insert({
                  envio_id: item.envio_id, loja_id: item.loja_id, instance_id: inst!.id,
                  status: "failed", error_reason: reason, http_status: 0,
                });
                console.log(`Queue failed: envio ${item.envio_id} — ${reason}`);
                continue;
              }
              // Use alternative instance
              inst = altInsts[0];
              await supabase
                .from("whatsapp_send_queue")
                .update({ instance_id: inst.id })
                .eq("id", item.id);
            }

            // Parse choices
            let choices: string[] = [];
            try {
              const parsed = typeof item.choices === "string" ? JSON.parse(item.choices) : item.choices;
              if (Array.isArray(parsed)) choices = parsed;
            } catch { /* ignore */ }

            const sendBody: Record<string, unknown> = {
              number: item.number,
              type: "button",
              text: item.msg_text,
              choices,
            };
            if (item.image_url) sendBody.imageButton = item.image_url;
            if (item.footer_text) sendBody.footerText = item.footer_text;

            const res = await fetch(`${UAZAPI_BASE}/send/menu`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                token: inst!.instance_token,
              },
              body: JSON.stringify(sendBody),
            });

            const resBody = await res.json();
            const waStatus = res.ok ? "sent" : "failed";
            const errorReason = res.ok ? null : (resBody?.message || resBody?.error || JSON.stringify(resBody).slice(0, 200));

            // Update queue item with error details
            await supabase
              .from("whatsapp_send_queue")
              .update({
                status: waStatus,
                processed_at: new Date().toISOString(),
                error_reason: errorReason,
                provider_response: resBody,
                http_status: res.status,
              })
              .eq("id", item.id);

            // Log to whatsapp_message_log with error details
            await supabase.from("whatsapp_message_log").insert({
              envio_id: item.envio_id,
              loja_id: item.loja_id,
              instance_id: inst!.id,
              status: waStatus,
              error_reason: errorReason,
              provider_response: resBody,
              http_status: res.status,
            });

            queueProcessed++;
            console.log(`Queue ${waStatus}: envio ${item.envio_id} via ${inst!.instance_name}${errorReason ? ` | ${errorReason}` : ""}`);

            // No artificial delay needed — we only process 1 item per loja per cron cycle
          } catch (qErr) {
            console.error(`Queue item ${item.id} failed:`, qErr);
            const errMsg = qErr instanceof Error ? qErr.message : "Unknown error";
            await supabase
              .from("whatsapp_send_queue")
              .update({ status: "failed", processed_at: new Date().toISOString(), error_reason: errMsg })
              .eq("id", item.id);
          }
        }
      }
    } catch (queueError) {
      console.error("Queue processing error:", queueError);
    }

    console.log(`Cron complete: processed ${totalProcessed} shipments, ${queueProcessed} queue items`);
    return new Response(
      JSON.stringify({ success: true, processed: totalProcessed, queue_processed: queueProcessed }),
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
  costMap: Record<string, number>,
  templateEventsCache: Record<string, any[]>
): Promise<boolean> {
  try {
    const { data: shipment, error: sErr } = await supabase
      .from("envios")
      .select("*, empresas(*)")
      .eq("id", envioId)
      .single();

    if (sErr || !shipment) return false;

    // ── RACE GUARD: respeita o delay mesmo se a query do caller estiver desatualizada ──
    const proximoAvancoCheck = (shipment as any).proximo_avanco_em;
    if (proximoAvancoCheck && new Date(proximoAvancoCheck) > new Date()) {
      console.log(`Skip envio ${envioId}: delay ainda não venceu (${proximoAvancoCheck})`);
      return false;
    }

    // Determine which template this shipment should use
    const templateIdToUse = shipment.postagem_template_id || config.template_ativo_id;
    if (!templateIdToUse) return false;

    // Fetch from cache or DB
    if (!templateEventsCache[templateIdToUse]) {
      const { data: fetchedEvents } = await supabase
        .from("postagem_eventos")
        .select("*")
        .eq("template_id", templateIdToUse)
        .order("ordem", { ascending: true });
      templateEventsCache[templateIdToUse] = fetchedEvents || [];
    }

    const allEvents = templateEventsCache[templateIdToUse];
    if (allEvents.length === 0) return false;

    // Filter events based on config
    const falhaNomes = ["Falha Entrega"];
    const taxNomes = ["Taxação", "Taxacao"];
    const filteredEvents = allEvents.filter((e: any) => {
      const en = (e.nome || "").trim();
      if (!config.ativar_falha_entrega && falhaNomes.includes(en)) return false;
      if (!config.ativar_taxacao && taxNomes.includes(en)) return false;
      if (en === "Pago" && !config.ativar_taxacao && !config.ativar_falha_entrega) return false;
      if (!config.enviar_nfe_email && e.enviar_nfe_pdf) return false;
      return true;
    });

    // Fallback: fetch empresa by loja_id if empresa_id was not set
    if (!shipment.empresas && shipment.loja_id) {
      const { data: fallbackEmpresa } = await supabase
        .from("empresas").select("*").eq("loja_id", shipment.loja_id).maybeSingle();
      if (fallbackEmpresa) (shipment as any).empresas = fallbackEmpresa;
    }

    const currentOrdem = shipment.ultimo_evento_ordem ?? 0;

    // deno-lint-ignore no-explicit-any
    const nextEvent = filteredEvents.find((e: any) => e.ordem > currentOrdem);
    if (!nextEvent) return false;

    const nextNome = (nextEvent.nome || "").trim();

    // ── REGRA: cron NUNCA avança automaticamente para eventos de aprovação manual ──
    // (Falha Entrega, Taxação, Pago, Entregue)
    const manualOnlyNomes = ["Pago", "Entregue"];
    if (manualOnlyNomes.includes(nextNome)) {
      // Lead permanece parado no evento atual (Falha Entrega / Taxação) aguardando aprovação manual
      await supabase
        .from("envios")
        .update({ proximo_avanco_em: null })
        .eq("id", envioId);
      return false;
    }

    // ── REGRA: cron NUNCA avança para "Entregue" — confirmação manual obrigatória ──
    const isFinalDelivered =
      nextNome === "Entregue" ||
      filteredEvents.indexOf(nextEvent) === filteredEvents.length - 1;
    if (isFinalDelivered) {
      await supabase
        .from("envios")
        .update({ status: "saiu_para_entrega", proximo_avanco_em: null })
        .eq("id", envioId);
      return false;
    }

    // Determine new status
    const totalEvents = filteredEvents.length;
    const eventIndex = filteredEvents.indexOf(nextEvent);
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
    const followingEvent = filteredEvents.find((e: any) => e.ordem > nextEvent.ordem);
    const proximoAvancoEm = followingEvent && followingEvent.delay_horas > 0
      ? new Date(Date.now() + followingEvent.delay_horas * 3600000).toISOString()
      : null;

    // ── DÉBITO PRIMEIRO (antes do avanço) ──
    // Se saldo insuficiente, envio fica pendente e cron tentará novamente após recarga.
    // Se outro processo avançar antes de nós (lock falha abaixo), estornamos o débito.
    let debitedTotal = 0;
    let debitedDescricao = "";
    if (currentOrdem === 0 && !(shipment as any).sem_cobranca) {
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
      if (config.ativar_falha_entrega && costMap["custo_falha_entrega"]) {
        total += costMap["custo_falha_entrega"];
        activeServices.push("Falha na Entrega");
      }

      if (total > 0) {
        const descricao = `Envio processado (${activeServices.join(", ")})`;
        const { data: debitOk, error: debitErr } = await supabase.rpc("debit_user_credits", {
          _user_id: lojaUserId,
          _quantidade: total,
          _descricao: descricao,
        });

        if (debitErr || !debitOk) {
          console.warn(`Insufficient balance for user ${lojaUserId}; envio ${envioId} permanece pendente até recarga.`);
          // Fire-and-forget low-balance alert (throttled to 1x/24h inside the function)
          supabase.functions.invoke("low-balance-alert", {
            body: { user_id: lojaUserId },
          }).catch((e: unknown) => console.error("low-balance-alert invoke failed:", e));
          // Envio continua pendente (ultimo_evento_ordem permanece 0). Próxima execução do cron tentará novamente.
          return false;
        }
        debitedTotal = total;
        debitedDescricao = descricao;
        console.log(`Debited ${total} credits for envio ${envioId}`);
      }
    }

    // ── OPTIMISTIC LOCK: só atualiza se ninguém mais avançou nesse meio tempo ──
    // Se outro processo já avançou, estornamos o débito (se houve) para evitar dupla cobrança.
    const { data: updatedRows, error: uErr } = await supabase
      .from("envios")
      .update({
        ultimo_evento_ordem: nextEvent.ordem,
        status: newStatus,
        status_label: nextEvent.status_label,
        proximo_avanco_em: proximoAvancoEm,
      })
      .eq("id", envioId)
      .eq("ultimo_evento_ordem", currentOrdem)
      .select("id");

    if (uErr) {
      console.error(`Failed to update envio ${envioId}:`, uErr);
      // Reverter débito se houve
      if (debitedTotal > 0) {
        await supabase.rpc("refund_user_credits", {
          _user_id: lojaUserId,
          _quantidade: debitedTotal,
          _descricao: `Estorno: falha ao avançar envio ${envioId} (${debitedDescricao})`,
        });
      }
      return false;
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.log(`Skip envio ${envioId}: já avançado por outro processo (lock)`);
      // Reverter débito (race condition: outro processo já cobrou e avançou)
      if (debitedTotal > 0) {
        await supabase.rpc("refund_user_credits", {
          _user_id: lojaUserId,
          _quantidade: debitedTotal,
          _descricao: `Estorno: envio ${envioId} avançado por outro processo (${debitedDescricao})`,
        });
      }
      return false;
    }

    // Check if this event should send email
    let isAtivo = false;
    if (nextEvent.enviar_nfe_pdf) {
      isAtivo = config.enviar_nfe_email;
    } else if (nextNome === "Taxação" || nextNome === "Taxacao") {
      isAtivo = config.ativar_taxacao;
    } else if (nextNome === "Falha Entrega") {
      isAtivo = config.ativar_falha_entrega;
    } else if (nextNome === "Pago") {
      isAtivo = config.ativar_taxacao || config.ativar_falha_entrega;
    } else {
      isAtivo = config.enviar_emails;
    }

    // Generate and upload NF-e PDF if needed (server-side with pdf-lib)
    let nfe_storage_path = "";
    let nfe_filename = "";

    if (nextEvent.enviar_nfe_pdf && shipment.empresas && config.enviar_nfe_email) {
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

    // Send email (com retry em caso de rate limit do Functions)
    if (isAtivo && nextEvent.enviar_email) {
      console.log(`Sending email for envio ${envioId}, event: ${nextEvent.nome}`);
      let funcErr: any = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        const res = await supabase.functions.invoke("send-email", {
          body: {
            envio_id: envioId,
            evento_id: nextEvent.id,
            loja_id: lojaId,
            nfe_storage_path,
            nfe_filename,
          },
        });
        funcErr = res.error;
        if (!funcErr) break;
        // Detecta RateLimitError do Edge Runtime e aguarda retryAfterMs
        const retryMs = funcErr?.context?.retryAfterMs ?? funcErr?.context?.retry_after_ms;
        const isRateLimit = funcErr?.context?.name === "RateLimitError" || (typeof retryMs === "number");
        if (!isRateLimit || attempt === 3) break;
        const waitMs = Math.min((retryMs || 2000) + 500, 15000);
        console.warn(`Rate limit ao invocar send-email (envio ${envioId}); aguardando ${waitMs}ms (tentativa ${attempt + 1}/4)`);
        await new Promise(r => setTimeout(r, waitMs));
      }
      if (funcErr) {
        console.error(`Email failed for envio ${envioId} (will revert advance):`, funcErr);
        // ── REVERTER O AVANÇO ──
        // O cliente paga pelo serviço (NF-e/e-mail). Se o envio do e-mail falhou
        // (ex: rate limit do Functions), revertemos a etapa e estornamos o débito,
        // de modo que o próximo ciclo do cron tentará novamente.
        const previousStatus =
          currentOrdem === 0 ? "pendente" : (shipment.status ?? "pendente");
        const previousStatusLabel =
          currentOrdem === 0 ? null : ((shipment as any).status_label ?? null);

        const { error: revertErr } = await supabase
          .from("envios")
          .update({
            ultimo_evento_ordem: currentOrdem,
            status: previousStatus,
            status_label: previousStatusLabel,
            proximo_avanco_em: null,
          })
          .eq("id", envioId)
          .eq("ultimo_evento_ordem", nextEvent.ordem);
        if (revertErr) {
          console.error(`Failed to revert envio ${envioId}:`, revertErr);
        }

        if (debitedTotal > 0) {
          await supabase.rpc("refund_user_credits", {
            _user_id: lojaUserId,
            _quantidade: debitedTotal,
            _descricao: `Estorno: falha ao enviar e-mail/NF-e do envio ${envioId} (${debitedDescricao})`,
          });
        }
        return false;
      }
    }

    // SMS dispatch — only when the flow is active
    if (!isAtivo) {
      console.log(`[SMS] Skip envio ${envioId}: event not active (isAtivo=false)`);
    } else if (!config.ativar_site_rastreio) {
      console.log(`[SMS] Skip envio ${envioId}: ativar_site_rastreio is OFF`);
    } else if (!shipment.cliente_telefone) {
      console.log(`[SMS] Skip envio ${envioId}: no cliente_telefone`);
    } else if (nextEvent.enviar_nfe_pdf) {
      console.log(`[SMS] Skip envio ${envioId}: NF-e event (email only)`);
    } else {
      const smsCost = (shipment as any).sem_cobranca ? 0 : (costMap["custo_sms_rastreio"] || 0);
      let canSendSms = true;

      if (smsCost > 0) {
        const { data: smsDebitOk, error: smsDebitErr } = await supabase.rpc("debit_user_credits", {
          _user_id: lojaUserId,
          _quantidade: smsCost,
          _descricao: `SMS enviado - ${nextEvent.status_label}`,
        });

        if (smsDebitErr || !smsDebitOk) {
          console.warn(`[SMS] Skip envio ${envioId}: insufficient balance (cost=${smsCost})`);
          canSendSms = false;
        } else {
          console.log(`[SMS] Debited ${smsCost} credits for envio ${envioId}`);
        }
      }

      if (canSendSms) {
        console.log(`[SMS] Dispatching for envio ${envioId}, status: ${nextEvent.status_label}, phone: ${shipment.cliente_telefone}`);
        const { error: smsErr } = await supabase.functions.invoke("send-sms", {
          body: { envio_id: envioId, loja_id: lojaId, status_label: nextEvent.status_label },
        });
        if (smsErr) {
          console.error(`[SMS] Failed for envio ${envioId}:`, smsErr);
        } else {
          console.log(`[SMS] Sent successfully for envio ${envioId}`);
        }
      }
    }

    // WhatsApp auto-send — enqueue with delay instead of sending directly
    // Skip on first advance (currentOrdem === 0) — already queued at creation time by auto-whatsapp-new-order
    if (
      currentOrdem > 0 &&
      config.whatsapp_auto_send &&
      shipment.cliente_telefone &&
      !nextEvent.enviar_nfe_pdf
    ) {
      try {
        // Build message from template
        let produtoNome = shipment.produto;
        try {
          const parsed = JSON.parse(shipment.produto);
          if (Array.isArray(parsed)) produtoNome = parsed.map((p: any) => p.nome).join(", ");
        } catch { /* not JSON */ }

        const msgTemplate = config.whatsapp_msg_template || "Olá {{nome}}! Seu pedido foi atualizado.";
        let text = msgTemplate
          .replace(/\{\{nome\}\}/g, shipment.cliente_nome || "")
          .replace(/\{\{produto\}\}/g, produtoNome)
          .replace(/\{\{valor\}\}/g, Number(shipment.valor || 0).toFixed(2))
          .replace(/\{\{codigo_rastreio\}\}/g, shipment.codigo_rastreio || "");

        const number = normalizeBrazilianPhone(shipment.cliente_telefone);

        const btnText = config.whatsapp_btn_text || "📦 Rastrear Pedido";
        const waRedirectUrl = Deno.env.get("SUPABASE_URL") || "";
        const trackingUrl = `${waRedirectUrl}/functions/v1/redirect?c=${shipment.codigo_rastreio || ""}`;
        const footerText = config.whatsapp_footer || "";
        const imageUrl = config.whatsapp_image_url || null;
        const replyText = config.whatsapp_reply_text || null;
        const btn2Text = config.whatsapp_btn2_text || null;
        const btn2Url = config.whatsapp_btn2_url || null;

        const choices: string[] = [];
        if (btnText && trackingUrl) choices.push(`${btnText}|${trackingUrl}`);
        if (btn2Text && btn2Url) choices.push(`${btn2Text}|${btn2Url}`);
        if (replyText) choices.push(replyText);

        // Calculate scheduled_at respecting delay
        const delaySeconds = config.whatsapp_delay_seconds || 300;

        const { data: lastQueued } = await supabase
          .from("whatsapp_send_queue")
          .select("scheduled_at")
          .eq("loja_id", lojaId)
          .eq("status", "pending")
          .order("scheduled_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const nowMs = Date.now();
        let scheduledAt: Date;

        if (lastQueued?.scheduled_at) {
          const lastTime = new Date(lastQueued.scheduled_at).getTime();
          const nextTime = lastTime + delaySeconds * 1000;
          scheduledAt = new Date(Math.max(nowMs, nextTime));
        } else {
          scheduledAt = new Date(nowMs);
        }

        await supabase.from("whatsapp_send_queue").insert({
          envio_id: envioId,
          loja_id: lojaId,
          number,
          msg_text: imageUrl ? `\n${text}` : text,
          image_url: imageUrl,
          footer_text: footerText || null,
          choices,
          scheduled_at: scheduledAt.toISOString(),
          status: "pending",
        });

        console.log(`WhatsApp queued for envio ${envioId}, scheduled_at: ${scheduledAt.toISOString()}`);
      } catch (waErr) {
        console.error(`WhatsApp queue failed for envio ${envioId}:`, waErr);
      }
    }

    // Process cashback when flow completes
    if (newStatus === "entregue") {
      try {
        const { data: cashbackVal, error: cbErr } = await supabase.rpc("process_cashback", {
          _envio_id: envioId,
          _user_id: lojaUserId,
        });
        if (cbErr) {
          console.error(`Cashback RPC error for envio ${envioId}:`, cbErr);
        } else if (cashbackVal && cashbackVal > 0) {
          console.log(`Cashback: ${cashbackVal} credits returned for envio ${envioId}`);
        }
      } catch (cbErr) {
        console.error(`Cashback failed for envio ${envioId}:`, cbErr);
      }
    }

    console.log(`Advanced envio ${envioId} -> ${nextEvent.status_label} (${newStatus})`);
    return true;
  } catch (err) {
    console.error(`Error advancing envio ${envioId}:`, err);
    return false;
  }
}
