import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { getAuthContext, unauthorized, forbidden } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NCM_CODES = ["61091000","62046200","64041900","85171200","84713012","33049910","42021200","42029200","71171900","96032100","39241000","85167100","94036000","49019900","85234990","62034200","61102000","85044090","90049090","95030090"];
const CST_CODES = ["102","101","103","202","300","400","500","900","000","010","020","041","060"];

function hashCode(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; } return h; }
function getRandomNcm(seed?: string): string { const i = seed ? Math.abs(hashCode(seed)) % NCM_CODES.length : 0; return NCM_CODES[i]; }
function getRandomCst(seed?: string): string { const i = seed ? Math.abs(hashCode(seed + "_cst")) % CST_CODES.length : 0; return CST_CODES[i]; }
function simpleHash(str: string): number { let h = 0; for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; } return Math.abs(h); }
function generateNfeNumero(envioId: string): string { const h = simpleHash(envioId); const num = (h % 999999) + 1; return String(num).padStart(9, "0").replace(/(\d{3})(\d{3})(\d{3})/, "$1.$2.$3"); }
function generateNfeChave(envioId: string): string { const h = simpleHash(envioId); let c = ""; for (let i = 0; i < 44; i++) c += String((h * (i + 1) + i * 7) % 10); return c; }
function formatCurrency(val: number): string { return val.toFixed(2).replace(".", ","); }
function truncate(text: string, maxLen: number): string { if (!text) return ""; return text.length > maxLen ? text.substring(0, maxLen - 2) + ".." : text; }

interface ProductItem { codigo?: number; nome: string; quantidade: number; valor: number; cfop?: string | null; ncm_sh?: string | null; cst?: string | null; unidade?: string | null; }

// deno-lint-ignore no-explicit-any
function parseProductItems(envio: any): ProductItem[] {
  const raw = envio.produto || "";
  if (raw.startsWith("[")) {
    try {
      const items = JSON.parse(raw) as ProductItem[];
      if (Array.isArray(items) && items.length > 0) {
        const hasAnyValor = items.some(i => i.valor && i.valor > 0);
        if (!hasAnyValor && envio.valor && envio.valor > 0) {
          const totalQty = items.reduce((s, i) => s + (i.quantidade || 1), 0);
          items.forEach(i => { i.valor = envio.valor / totalQty; });
        }
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
  return [{ codigo: 1, nome: raw || "Produto", quantidade: envio.quantidade || 1, valor: envio.valor || 0, cfop: envio.cfop || "5102", ncm_sh: envio.ncm_sh || getRandomNcm(seed), cst: envio.cst || getRandomCst(seed), unidade: envio.unidade }];
}

// deno-lint-ignore no-explicit-any
async function generateDanfePdf(empresa: any, envio: any): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const fontBold = await pdfDoc.embedFont(StandardFonts.CourierBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Courier);
  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);
  const lightGray = rgb(0.92, 0.92, 0.92);
  const margin = 30;
  const colWidth = width - 2 * margin;
  let y = height - margin;
  const drawText = (t: string, x: number, yP: number, sz: number, fn = fontRegular, c = black) => page.drawText(t || "", { x, y: yP, size: sz, font: fn, color: c });
  const drawLine = (x1: number, y1: number, x2: number, y2: number) => page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.5, color: black });
  const drawRect = (x: number, yP: number, w: number, h: number, c = lightGray) => page.drawRectangle({ x, y: yP, width: w, height: h, color: c });

  drawRect(margin, y - 50, colWidth, 50);
  drawText("DANFE - DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA", margin + 10, y - 20, 8, fontBold);
  drawText("ENTRADA/SAÍDA: 1 (Saída)", margin + 10, y - 35, 7);
  y -= 60;
  drawText(truncate(empresa?.nome_fantasia || empresa?.razao_social || "EMPRESA", 60), margin, y, 9, fontBold); y -= 12;
  drawText(truncate(empresa?.razao_social || "", 70), margin, y, 7); y -= 12;
  const endEmpresa = [empresa?.endereco, empresa?.numero, empresa?.bairro, empresa?.cidade, empresa?.estado].filter(Boolean).join(", ");
  drawText(truncate(endEmpresa, 80), margin, y, 7); y -= 12;
  drawText(`CNPJ: ${empresa?.cnpj || "N/A"}   IE: ${empresa?.inscricao_estadual || "N/A"}`, margin, y, 7); y -= 20;

  const nfeNumero = envio.nfe_numero || generateNfeNumero(envio.id);
  const nfeSerie = envio.nfe_serie || "001";
  const nfeChave = envio.nfe_chave_acesso || generateNfeChave(envio.id);
  drawLine(margin, y, margin + colWidth, y); y -= 12;
  drawText(`NF-e Nº: ${nfeNumero}`, margin, y, 8, fontBold);
  drawText(`Série: ${nfeSerie}`, margin + 200, y, 8); y -= 12;
  drawText(`Chave de Acesso: ${nfeChave}`, margin, y, 7); y -= 20;

  drawLine(margin, y, margin + colWidth, y); y -= 5;
  drawText("DESTINATÁRIO / REMETENTE", margin, y, 8, fontBold); y -= 14;
  drawText(`Nome: ${envio.cliente_nome || ""}`, margin, y, 7); y -= 12;
  drawText(`CPF/CNPJ: ${envio.cliente_cpf || "N/A"}`, margin, y, 7); y -= 12;
  const endDest = [envio.cliente_endereco, envio.cliente_numero, envio.cliente_bairro].filter(Boolean).join(", ");
  drawText(`Endereço: ${truncate(endDest, 70)}`, margin, y, 7); y -= 12;
  drawText(`Cidade: ${envio.cliente_cidade || ""}  UF: ${envio.cliente_estado || ""}  CEP: ${envio.cliente_cep || ""}`, margin, y, 7); y -= 20;

  drawLine(margin, y, margin + colWidth, y); y -= 5;
  drawText("DADOS DOS PRODUTOS / SERVIÇOS", margin, y, 8, fontBold); y -= 14;
  drawRect(margin, y - 2, colWidth, 14);
  const cols = [margin, margin + 30, margin + 230, margin + 280, margin + 330, margin + 390, margin + 440, margin + 490];
  const headers = ["CÓD", "DESCRIÇÃO", "NCM/SH", "CST", "CFOP", "UN", "QTD", "V.UNIT"];
  headers.forEach((h, i) => drawText(h, cols[i], y, 6, fontBold));
  y -= 16;
  const items = parseProductItems(envio);
  items.forEach((item, idx) => {
    if (idx % 2 === 0) drawRect(margin, y - 2, colWidth, 12, lightGray);
    drawText(String(item.codigo || idx + 1), cols[0], y, 6);
    drawText(truncate(item.nome, 30), cols[1], y, 6);
    drawText(item.ncm_sh || getRandomNcm(String(idx)), cols[2], y, 6);
    drawText(item.cst || getRandomCst(String(idx)), cols[3], y, 6);
    drawText(item.cfop || "5102", cols[4], y, 6);
    drawText(item.unidade || "UN", cols[5], y, 6);
    drawText(String(item.quantidade), cols[6], y, 6);
    drawText(formatCurrency(item.valor), cols[7], y, 6);
    y -= 14;
  });
  y -= 10;
  drawLine(margin, y, margin + colWidth, y); y -= 14;
  const totalVal = items.reduce((s, i) => s + i.valor * i.quantidade, 0);
  drawText(`VALOR TOTAL DOS PRODUTOS: R$ ${formatCurrency(totalVal)}`, margin, y, 8, fontBold); y -= 14;
  drawText(`VALOR TOTAL DA NOTA: R$ ${formatCurrency(envio.valor || totalVal)}`, margin, y, 8, fontBold);
  y -= 30;
  drawText("Documento auxiliar gerado automaticamente pelo sistema.", margin, y, 6, fontRegular, gray);
  return await pdfDoc.save();
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await getAuthContext(req);
    if (!auth.isServiceRole && !auth.userId) return unauthorized();

    const { envio_id } = await req.json();
    if (!envio_id || typeof envio_id !== "string") {
      return jsonResponse({ error: "envio_id obrigatório" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: envio, error: eErr } = await supabase
      .from("envios")
      .select("*, lojas!inner(id, user_id)")
      .eq("id", envio_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (eErr || !envio) return jsonResponse({ error: "Envio não encontrado" }, 404);

    const ownerId = (envio as any).lojas.user_id;
    if (!auth.isServiceRole && !auth.isAdmin && auth.userId !== ownerId) {
      return forbidden();
    }

    // Carrega empresa
    let empresa: any = null;
    if ((envio as any).empresa_id) {
      const { data } = await supabase.from("empresas").select("*").eq("id", (envio as any).empresa_id).maybeSingle();
      empresa = data;
    }
    if (!empresa) {
      const { data } = await supabase.from("empresas").select("*").eq("loja_id", (envio as any).loja_id).maybeSingle();
      empresa = data;
    }
    if (!empresa) {
      empresa = { razao_social: "Empresa", cnpj: "00.000.000/0000-00" };
    }

    // Cobrança (apenas se ainda não foi cobrado)
    const jaCobrado = (envio as any).nfe_cobrado === true;
    if (!jaCobrado) {
      const { data: custoRow } = await supabase
        .from("system_config")
        .select("value")
        .eq("key", "custo_nfe_email")
        .maybeSingle();
      const custo = Number(custoRow?.value ?? 0.5);

      if (custo > 0) {
        const { data: debitOk, error: debitErr } = await supabase.rpc("debit_user_credits", {
          _user_id: ownerId,
          _quantidade: custo,
          _descricao: `Download manual NF-e (envio ${envio_id.slice(0, 8)})`,
        });
        if (debitErr) {
          console.error("Erro ao debitar:", debitErr);
          return jsonResponse({ error: "Falha ao processar débito" }, 500);
        }
        if (!debitOk) {
          return jsonResponse({ error: "Saldo insuficiente para baixar a NF-e" }, 402);
        }
      }

      // Marca como cobrado
      const { error: upErr } = await supabase
        .from("envios")
        .update({ nfe_cobrado: true })
        .eq("id", envio_id);
      if (upErr) {
        console.error("Falha ao marcar nfe_cobrado:", upErr);
        // Mesmo assim segue: usuário já foi cobrado e merece o PDF.
      }
    }

    // Gera PDF server-side
    // IMPORTANTE: download-nfe NÃO avança o envio, NÃO chama email-trigger,
    // NÃO chama advance-shipments e NÃO inicia o fluxo. Apenas debita (uma vez)
    // e devolve o PDF. Qualquer avanço observado vem do cron advance-shipments
    // quando postagem_config.auto_envio = true.
    console.log(`download-nfe: envio ${envio_id} processado (charged=${!jaCobrado}). Nenhum avanço de fluxo executado.`);
    const pdfBytes = await generateDanfePdf(empresa, envio);
    const base64 = bytesToBase64(pdfBytes);
    const filename = `DANFE_${(envio as any).cliente_nome?.replace(/\s+/g, "_") || envio_id}.pdf`;

    return jsonResponse({ pdf_base64: base64, filename, charged: !jaCobrado });
  } catch (err) {
    console.error("download-nfe error:", err);
    return jsonResponse({ error: (err as Error).message || "Erro interno" }, 500);
  }
});
