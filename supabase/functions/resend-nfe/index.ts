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
      if (Array.isArray(items) && items.length > 0) {
        const hasAnyValor = items.some(i => i.valor && i.valor > 0);
        if (!hasAnyValor && envio.valor && envio.valor > 0) {
          const totalQty = items.reduce((s, i) => s + (i.quantidade || 1), 0);
          items.forEach(i => { i.valor = envio.valor / totalQty; });
        }
        items.forEach(i => {
          if (!i.cfop) i.cfop = envio.cfop;
          if (!i.ncm_sh) i.ncm_sh = envio.ncm_sh;
          if (!i.cst) i.cst = envio.cst;
          if (!i.unidade) i.unidade = envio.unidade;
        });
        return items;
      }
    } catch { /* fallthrough */ }
  }
  return [{
    codigo: 1, nome: raw || "Produto", quantidade: envio.quantidade || 1,
    valor: envio.valor || 0, cfop: envio.cfop, ncm_sh: envio.ncm_sh, cst: envio.cst, unidade: envio.unidade,
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

  const drawText = (text: string, x: number, yPos: number, size: number, font = fontRegular, color = black) => {
    page.drawText(text || "", { x, y: yPos, size, font, color });
  };
  const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.5, color: black });
  };
  const drawRect = (x: number, yPos: number, w: number, h: number, color = lightGray) => {
    page.drawRectangle({ x, y: yPos, width: w, height: h, color });
  };

  // Header
  drawRect(margin, y - 50, colWidth, 50);
  drawText("DANFE - DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA", margin + 10, y - 20, 8, fontBold);
  drawText("ENTRADA/SAÍDA: 1 (Saída)", margin + 10, y - 35, 7);
  y -= 60;

  // Empresa info
  drawText(truncate(empresa?.nome_fantasia || empresa?.razao_social || "EMPRESA", 60), margin, y, 9, fontBold);
  y -= 12;
  drawText(truncate(empresa?.razao_social || "", 70), margin, y, 7);
  y -= 12;
  const endEmpresa = [empresa?.endereco, empresa?.numero, empresa?.bairro, empresa?.cidade, empresa?.estado].filter(Boolean).join(", ");
  drawText(truncate(endEmpresa, 80), margin, y, 7);
  y -= 12;
  drawText(`CNPJ: ${empresa?.cnpj || "N/A"}   IE: ${empresa?.inscricao_estadual || "N/A"}`, margin, y, 7);
  y -= 20;

  // NF-e info
  drawLine(margin, y, margin + colWidth, y);
  y -= 12;
  drawText(`NF-e Nº: ${envio.nfe_numero || "000001"}`, margin, y, 8, fontBold);
  drawText(`Série: ${envio.nfe_serie || "001"}`, margin + 200, y, 8);
  y -= 12;
  drawText(`Chave de Acesso: ${envio.nfe_chave_acesso || "N/A"}`, margin, y, 7);
  y -= 20;

  // Destinatário
  drawLine(margin, y, margin + colWidth, y);
  y -= 5;
  drawText("DESTINATÁRIO / REMETENTE", margin, y, 8, fontBold);
  y -= 14;
  drawText(`Nome: ${envio.cliente_nome || ""}`, margin, y, 7);
  y -= 12;
  drawText(`CPF/CNPJ: ${envio.cliente_cpf || "N/A"}`, margin, y, 7);
  y -= 12;
  const endDest = [envio.cliente_endereco, envio.cliente_numero, envio.cliente_bairro].filter(Boolean).join(", ");
  drawText(`Endereço: ${truncate(endDest, 70)}`, margin, y, 7);
  y -= 12;
  drawText(`Cidade: ${envio.cliente_cidade || ""}  UF: ${envio.cliente_estado || ""}  CEP: ${envio.cliente_cep || ""}`, margin, y, 7);
  y -= 20;

  // Products header
  drawLine(margin, y, margin + colWidth, y);
  y -= 5;
  drawText("DADOS DOS PRODUTOS / SERVIÇOS", margin, y, 8, fontBold);
  y -= 14;
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
    drawText(item.ncm_sh || "", cols[2], y, 6);
    drawText(item.cst || "", cols[3], y, 6);
    drawText(item.cfop || "", cols[4], y, 6);
    drawText(item.unidade || "UN", cols[5], y, 6);
    drawText(String(item.quantidade), cols[6], y, 6);
    drawText(formatCurrency(item.valor), cols[7], y, 6);
    y -= 14;
  });

  y -= 10;
  drawLine(margin, y, margin + colWidth, y);
  y -= 14;
  const totalVal = items.reduce((s, i) => s + i.valor * i.quantidade, 0);
  drawText(`VALOR TOTAL DOS PRODUTOS: R$ ${formatCurrency(totalVal)}`, margin, y, 8, fontBold);
  y -= 14;
  drawText(`VALOR TOTAL DA NOTA: R$ ${formatCurrency(envio.valor || totalVal)}`, margin, y, 8, fontBold);

  y -= 30;
  drawText("Documento auxiliar gerado automaticamente pelo sistema.", margin, y, 6, fontRegular, gray);

  return await pdfDoc.save();
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { loja_id, date_from, date_to } = await req.json();
    if (!loja_id) {
      return new Response(JSON.stringify({ error: "loja_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get config + template
    const { data: config } = await supabase
      .from("postagem_config")
      .select("template_ativo_id, email_remetente")
      .eq("loja_id", loja_id)
      .maybeSingle();

    if (!config?.template_ativo_id) {
      return new Response(JSON.stringify({ error: "No active template" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find NF-e event in the template
    const { data: nfeEvent } = await supabase
      .from("postagem_eventos")
      .select("id, ordem, nome, assunto_email, corpo_email")
      .eq("template_id", config.template_ativo_id)
      .eq("enviar_nfe_pdf", true)
      .maybeSingle();

    if (!nfeEvent) {
      return new Response(JSON.stringify({ error: "No NF-e event found in template" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get empresa for this loja
    const { data: empresa } = await supabase
      .from("empresas")
      .select("*")
      .eq("loja_id", loja_id)
      .maybeSingle();

    if (!empresa) {
      return new Response(JSON.stringify({ error: "No empresa found for this loja" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find all envios that already passed the NF-e event
    const { data: envios, error: enviosErr } = await supabase
      .from("envios")
      .select("*")
      .eq("loja_id", loja_id)
      .gte("ultimo_evento_ordem", nfeEvent.ordem)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (enviosErr || !envios || envios.length === 0) {
      return new Response(JSON.stringify({ error: "No envios found to resend", details: enviosErr }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${envios.length} envios to resend NF-e for loja ${loja_id}`);

    const results: Array<{ envio_id: string; status: string; error?: string }> = [];

    for (const envio of envios) {
      try {
        // Generate corrected PDF
        const pdfBytes = await generateDanfePdf(empresa, envio);
        const nfe_filename = `DANFE_${Math.floor(Math.random() * 9000000000 + 1000000000)}.pdf`;
        const storagePath = `${envio.id}/${nfe_filename}`;

        const { error: uploadErr } = await supabase.storage
          .from("nfe-pdfs")
          .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: true });

        if (uploadErr) {
          console.error(`PDF upload failed for envio ${envio.id}:`, uploadErr);
          results.push({ envio_id: envio.id, status: "error", error: "PDF upload failed" });
          continue;
        }

        // Send email WITHOUT debiting credits
        const { error: emailErr } = await supabase.functions.invoke("send-email", {
          body: {
            envio_id: envio.id,
            evento_id: nfeEvent.id,
            loja_id: loja_id,
            nfe_storage_path: storagePath,
            nfe_filename: nfe_filename,
            skip_debit: true, // signal to not charge
          },
        });

        if (emailErr) {
          console.error(`Email failed for envio ${envio.id}:`, emailErr);
          results.push({ envio_id: envio.id, status: "error", error: "Email send failed" });
        } else {
          console.log(`Resent NF-e for envio ${envio.id}`);
          results.push({ envio_id: envio.id, status: "sent" });
        }

        // Delay to avoid rate limit
        await delay(500);
      } catch (err) {
        console.error(`Error processing envio ${envio.id}:`, err);
        results.push({ envio_id: envio.id, status: "error", error: String(err) });
      }
    }

    const sent = results.filter(r => r.status === "sent").length;
    const failed = results.filter(r => r.status === "error").length;

    return new Response(JSON.stringify({
      message: `Resent ${sent} NF-e emails, ${failed} failed`,
      total: envios.length,
      sent,
      failed,
      results,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in resend-nfe:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
