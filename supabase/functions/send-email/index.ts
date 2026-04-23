import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const NCM_CODES = ["61091000","62046200","64041900","85171200","84713012","33049910","42021200","42029200","71171900","96032100","39241000","85167100","94036000","49019900","85234990","62034200","61102000","85044090","90049090","95030090"];
const CST_CODES = ["102","101","103","202","300","400","500","900","000","010","020","041","060"];
function hashCode(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; } return h; }
function getRandomNcm(seed?: string): string { const i = seed ? Math.abs(hashCode(seed)) % NCM_CODES.length : Math.floor(Math.random() * NCM_CODES.length); return NCM_CODES[i]; }
function getRandomCst(seed?: string): string { const i = seed ? Math.abs(hashCode(seed + "_cst")) % CST_CODES.length : Math.floor(Math.random() * CST_CODES.length); return CST_CODES[i]; }

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
  nfe_storage_path?: string;
  nfe_filename?: string;
  generate_nfe_server?: boolean;
  skip_debit?: boolean;
}

// ============ Server-side DANFE PDF generation ============

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
        const hasAnyValor = items.some((i: ProductItem) => i.valor && i.valor > 0);
        if (!hasAnyValor && envio.valor && envio.valor > 0) {
          const totalQty = items.reduce((s: number, i: ProductItem) => s + (i.quantidade || 1), 0);
          items.forEach((i: ProductItem) => { i.valor = envio.valor / totalQty; });
        }
        items.forEach((i: ProductItem, idx: number) => {
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
    codigo: 1, nome: raw || "Produto", quantidade: envio.quantidade || 1,
    valor: envio.valor || 0, cfop: envio.cfop || "5102", ncm_sh: envio.ncm_sh || getRandomNcm(seed), cst: envio.cst || getRandomCst(seed), unidade: envio.unidade,
  }];
}

function formatCurrencyPdf(val: number): string {
  return val.toFixed(2).replace(".", ",");
}

function truncatePdf(text: string, maxLen: number): string {
  if (!text) return "";
  return text.length > maxLen ? text.substring(0, maxLen - 2) + ".." : text;
}

// deno-lint-ignore no-explicit-any
async function generateDanfePdfServerSide(empresa: any, envio: any): Promise<Uint8Array> {
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

  drawRect(margin, y - 50, colWidth, 50);
  drawText("DANFE - DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA", margin + 10, y - 20, 8, fontBold);
  drawText("ENTRADA/SAÍDA: 1 (Saída)", margin + 10, y - 35, 7);
  y -= 60;

  drawText(truncatePdf(empresa?.nome_fantasia || empresa?.razao_social || "EMPRESA", 60), margin, y, 9, fontBold);
  y -= 12;
  drawText(truncatePdf(empresa?.razao_social || "", 70), margin, y, 7);
  y -= 12;
  const endEmpresa = [empresa?.endereco, empresa?.numero, empresa?.bairro, empresa?.cidade, empresa?.estado].filter(Boolean).join(", ");
  drawText(truncatePdf(endEmpresa, 80), margin, y, 7);
  y -= 12;
  drawText(`CNPJ: ${empresa?.cnpj || "N/A"}   IE: ${empresa?.inscricao_estadual || "N/A"}`, margin, y, 7);
  y -= 20;

  drawLine(margin, y, margin + colWidth, y);
  y -= 12;
  drawText(`NF-e Nº: ${envio.nfe_numero || "000001"}`, margin, y, 8, fontBold);
  drawText(`Série: ${envio.nfe_serie || "001"}`, margin + 200, y, 8);
  y -= 12;
  drawText(`Chave de Acesso: ${envio.nfe_chave_acesso || "N/A"}`, margin, y, 7);
  y -= 20;

  drawLine(margin, y, margin + colWidth, y);
  y -= 5;
  drawText("DESTINATÁRIO / REMETENTE", margin, y, 8, fontBold);
  y -= 14;
  drawText(`Nome: ${envio.cliente_nome || ""}`, margin, y, 7);
  y -= 12;
  drawText(`CPF/CNPJ: ${envio.cliente_cpf || "N/A"}`, margin, y, 7);
  y -= 12;
  const endDest = [envio.cliente_endereco, envio.cliente_numero, envio.cliente_bairro].filter(Boolean).join(", ");
  drawText(`Endereço: ${truncatePdf(endDest, 70)}`, margin, y, 7);
  y -= 12;
  drawText(`Cidade: ${envio.cliente_cidade || ""}  UF: ${envio.cliente_estado || ""}  CEP: ${envio.cliente_cep || ""}`, margin, y, 7);
  y -= 20;

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
    drawText(truncatePdf(item.nome, 30), cols[1], y, 6);
    drawText(item.ncm_sh || getRandomNcm(String(idx)), cols[2], y, 6);
    drawText(item.cst || getRandomCst(String(idx)), cols[3], y, 6);
    drawText(item.cfop || "", cols[4], y, 6);
    drawText(item.unidade || "UN", cols[5], y, 6);
    drawText(String(item.quantidade), cols[6], y, 6);
    drawText(formatCurrencyPdf(item.valor), cols[7], y, 6);
    y -= 14;
  });

  y -= 10;
  drawLine(margin, y, margin + colWidth, y);
  y -= 14;
  const totalVal = items.reduce((s, i) => s + i.valor * i.quantidade, 0);
  drawText(`VALOR TOTAL DOS PRODUTOS: R$ ${formatCurrencyPdf(totalVal)}`, margin, y, 8, fontBold);
  y -= 14;
  drawText(`VALOR TOTAL DA NOTA: R$ ${formatCurrencyPdf(envio.valor || totalVal)}`, margin, y, 8, fontBold);

  y -= 30;
  drawText("Documento auxiliar gerado automaticamente pelo sistema.", margin, y, 6, fontRegular, gray);

  return await pdfDoc.save();
}

const DEFAULT_TRANSPORTADORA = "JL Transportadora e Logística LTDA";

// ============ Vizinho (Neighbor) deterministic logic ============
const VIZINHO_NOMES = [
  "Maria Aparecida","José Carlos","Ana Paula","Carlos Eduardo","Fernanda Silva",
  "Mariana Oliveira","Roberto Souza","Patrícia Lima","Lucas Ferreira","Juliana Costa",
  "André Mendes","Beatriz Almeida","Rafael Santos","Camila Ribeiro","Thiago Pereira",
  "Larissa Barbosa","Gustavo Rocha","Isabela Cardoso","Diego Martins","Vanessa Araújo",
  "Felipe Nascimento","Tatiana Moreira","Bruno Teixeira","Priscila Correia","Rodrigo Pinto",
  "Aline Monteiro","Marcelo Duarte","Renata Farias","Leandro Machado","Gabriela Nunes",
  "Eduardo Vieira","Sandra Carvalho","Henrique Dias","Elaine Castro","Marcos Lopes",
  "Cláudia Ramos","Alexandre Gonçalves","Luciana Freitas","Paulo Nogueira","Adriana Campos",
  "Fábio Azevedo","Cristiane Melo","Ricardo Guimarães","Simone Borges","Vinícius Cunha",
  "Daniele Moraes","Sérgio Cavalcanti","Andréa Pires","Cássio Braga","Lúcia Fontes",
  "Peterson Reis","Elisa Tavares","Willian Amaral","Débora Siqueira","Reginaldo Batista",
  "Jéssica Gomes","Rogério Xavier","Monique Miranda","Otávio Coelho","Carolina Sampaio",
  "Matheus Andrade","Viviane Passos","Leonardo Medeiros","Rosana Rezende","Jorge Figueiredo",
  "Bianca Peixoto","Daniel Alencar","Flávia Assis","Maurício Sales","Eliane Barros",
  "Caio Bittencourt","Karina Bastos","Raul Queiroz","Natália Marques","César Leal",
  "Amanda Esteves","Ronaldo Lacerda","Ingrid Rangel","Augusto Brandão","Sabrina Aguiar",
  "Luís Henrique","Tereza Silveira","Thales Pacheco","Lia Domingues","Nelson Valente",
  "Letícia Vasconcelos","Ítalo Bezerra","Miriam Paiva","Otton Coutinho","Raquel Trindade",
  "Wendel Magalhães","Heloísa Barreto","Caetano Soares","Milena Sá","Josué Maciel",
  "Lorena Dornelas","Murilo Carneiro","Sueli Torres","Davi Ferraz","Fabiana Bonfim"
];
const VIZINHO_CPFS = [
  "***.234.567-**","***.891.012-**","***.456.789-**","***.123.654-**","***.987.321-**",
  "***.412.553-**","***.882.119-**","***.321.774-**","***.675.238-**","***.194.667-**",
  "***.548.391-**","***.763.825-**","***.217.946-**","***.836.512-**","***.459.173-**",
  "***.628.347-**","***.185.729-**","***.974.163-**","***.342.586-**","***.716.438-**",
  "***.293.851-**","***.567.214-**","***.831.479-**","***.148.635-**","***.479.362-**",
  "***.654.128-**","***.218.543-**","***.965.271-**","***.537.894-**","***.183.426-**",
  "***.742.615-**","***.316.958-**","***.894.237-**","***.461.573-**","***.825.149-**",
  "***.573.461-**","***.149.826-**","***.638.274-**","***.271.938-**","***.486.152-**",
  "***.952.347-**","***.314.568-**","***.768.423-**","***.527.196-**","***.693.814-**",
  "***.241.679-**","***.856.312-**","***.419.753-**","***.782.146-**","***.365.827-**",
  "***.128.594-**","***.974.263-**","***.543.817-**","***.617.342-**","***.286.951-**",
  "***.831.624-**","***.472.158-**","***.615.439-**","***.359.872-**","***.724.516-**",
  "***.196.743-**","***.843.269-**","***.567.391-**","***.231.684-**","***.918.527-**",
  "***.684.213-**","***.352.978-**","***.719.345-**","***.463.891-**","***.297.536-**",
  "***.836.174-**","***.571.429-**","***.148.763-**","***.925.618-**","***.413.952-**",
  "***.769.384-**","***.284.537-**","***.651.829-**","***.937.146-**","***.512.673-**",
  "***.346.291-**","***.879.534-**","***.423.867-**","***.198.745-**","***.764.312-**",
  "***.531.498-**","***.847.623-**","***.275.981-**","***.618.357-**","***.493.712-**",
  "***.156.849-**","***.729.436-**","***.384.571-**","***.962.183-**","***.517.264-**",
  "***.643.918-**","***.238.475-**","***.871.532-**","***.426.197-**","***.793.648-**"
];

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getVizinhoExtras(envioId: string, clienteNome: string): Record<string, string> {
  const idx = simpleHash(envioId) % VIZINHO_NOMES.length;
  const primeiroNome = clienteNome.split(" ")[0];
  return {
    recebedor_nome: VIZINHO_NOMES[idx],
    recebedor_cpf: VIZINHO_CPFS[idx],
    cliente_primeiro_nome: primeiroNome,
  };
}

const emojiMap: Record<string, string> = {
  "Postado": "📄",
  "Nota Fiscal Emitida": "📄",
  "Pedido Confirmado": "📄",
  "Coletado": "📦",
  "Em Trânsito": "🚛",
  "Em Rota": "🏍️",
  "Centro Local": "📍",
  "Saiu para Entrega": "🚚",
  "Entregue": "✅",
  "Taxação": "⚠️",
  "Pago": "💳",
  "Falha Entrega": "❌",
  "Reenvio Pago": "✅",
  "Reenvio Saiu": "🚚",
};

function decodeHtmlEntities(str: string): string {
  return str.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)));
}

function formatProdutoName(raw: string): string {
  try {
    const items = JSON.parse(raw);
    if (Array.isArray(items)) {
      return items
        .map((i: any) => {
          const name = decodeHtmlEntities(i.name || i.nome || i.title || "Produto");
          const qty = i.quantity || i.quantidade || 1;
          return qty > 1 ? `${name} (x${qty})` : name;
        })
        .join(", ");
    }
  } catch {
    // not JSON
  }
  return decodeHtmlEntities(raw);
}

function replaceVariables(
  text: string,
  envio: Record<string, unknown>,
  extras: Record<string, string> = {}
): string {
  const transportadora = (envio.transportadora as string) || DEFAULT_TRANSPORTADORA;
  const produtoRaw = (envio.produto as string) || "";
  const produtoFormatted = formatProdutoName(produtoRaw);

  let result = text
    .replace(/\{\{cliente_nome\}\}/g, (envio.cliente_nome as string) || "")
    .replace(/\{\{cliente_email\}\}/g, (envio.cliente_email as string) || "")
    .replace(/\{\{produto\}\}/g, produtoFormatted)
    .replace(/\{\{codigo_rastreio\}\}/g, (envio.codigo_rastreio as string) || "")
    .replace(/\{\{transportadora\}\}/g, transportadora)
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

interface TaxacaoSettings {
  mensagem_taxa: string;
  texto_botao: string;
  valor_exemplo: string;
  prazo_dias: string;
  url_pagamento: string;
  forma_pagamento: string;
  cor_botao: string;
  cor_header: string;
  mostrar_valor: boolean;
  mostrar_prazo: boolean;
}

function parseTaxacaoSettings(corpoEmail: string): TaxacaoSettings | null {
  if (!corpoEmail || !corpoEmail.includes("{{taxacao_url:")) return null;

  const urlMatch = corpoEmail.match(/\{\{taxacao_url:([^}]*)\}\}/);
  const botaoMatch = corpoEmail.match(/\{\{taxacao_botao:([^}]*)\}\}/);
  const valorMatch = corpoEmail.match(/\{\{taxacao_valor:([^}]*)\}\}/);
  const corMatch = corpoEmail.match(/\{\{taxacao_cor:([^}]*)\}\}/);
  const corHeaderMatch = corpoEmail.match(/\{\{taxacao_cor_header:([^}]*)\}\}/);
  const prazoMatch = corpoEmail.match(/\{\{taxacao_prazo:([^}]*)\}\}/);
  const formaMatch = corpoEmail.match(/\{\{taxacao_forma:([^}]*)\}\}/);
  const mostrarValorMatch = corpoEmail.match(/\{\{taxacao_mostrar_valor:([^}]*)\}\}/);
  const mostrarPrazoMatch = corpoEmail.match(/\{\{taxacao_mostrar_prazo:([^}]*)\}\}/);

  const msgEnd = corpoEmail.indexOf("{{taxacao_");
  const plainMessage = msgEnd > 0 ? corpoEmail.substring(0, msgEnd).trim() : "Fiscalização aduaneira concluída - aguardando pagamento";

  return {
    mensagem_taxa: plainMessage,
    texto_botao: botaoMatch?.[1] || "PAGUE AGORA",
    valor_exemplo: valorMatch?.[1] || "0.00",
    prazo_dias: prazoMatch?.[1] || "5",
    url_pagamento: urlMatch?.[1] || "",
    forma_pagamento: formaMatch?.[1] || "Todos",
    cor_botao: corMatch?.[1] || "#2563eb",
    cor_header: corHeaderMatch?.[1] || "#f59e0b",
    mostrar_valor: mostrarValorMatch ? mostrarValorMatch[1] === "true" : true,
    mostrar_prazo: mostrarPrazoMatch ? mostrarPrazoMatch[1] === "true" : true,
  };
}

interface FalhaEntregaSettings {
  msg_falha_entrega: string;
  checkout_url_falha: string;
  valor_taxa_falha: string;
}

function parseFalhaEntregaSettings(
  corpoEmail: string,
  configCheckoutUrl?: string,
  configValorTaxa?: number | string
): FalhaEntregaSettings | null {
  if (!corpoEmail || !corpoEmail.includes("{{falha_")) return null;

  const msgEnd = corpoEmail.indexOf("{{falha_");
  const plainMessage = msgEnd > 0 ? corpoEmail.substring(0, msgEnd).trim() : "Houve uma falha na entrega.";

  return {
    msg_falha_entrega: plainMessage,
    checkout_url_falha: configCheckoutUrl || "",
    valor_taxa_falha: String(configValorTaxa || "0.00"),
  };
}

function buildWhatsAppButton(whatsapp: string): string {
  if (!whatsapp) return "";
  const cleanNumber = whatsapp.replace(/\D/g, "");
  if (!cleanNumber) return "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:12px auto 0;">
    <tr><td style="background-color:#25D366;border-radius:50px;box-shadow:0 4px 16px #25D36644;">
      <a href="https://wa.me/${cleanNumber}" style="display:inline-block;color:#ffffff;text-decoration:none;padding:12px 36px;font-size:13px;font-weight:700;letter-spacing:0.3px;">💬 Fale Com o Vendedor</a>
    </td></tr>
  </table>`;
}

// ============ Upsell Block Builder ============
interface UpsellConfig {
  ativo: boolean;
  headline: string;
  sub_headline: string;
  produto_nome: string;
  produto_descricao: string;
  produto_valor: string;
  produto_imagem_url: string;
  botao_texto: string;
  botao_url: string;
  cor_headline: string;
  cor_sub_headline: string;
  cor_nome_produto: string;
  cor_descricao: string;
  cor_valor: string;
  cor_botao_bg: string;
  cor_botao_texto: string;
  cor_fundo: string;
}

function buildUpsellHtml(u: UpsellConfig): string {
  const imageBlock = u.produto_imagem_url
    ? `<td width="120" style="padding-right:16px;vertical-align:top;">
        <img src="${u.produto_imagem_url}" alt="${u.produto_nome}" width="120" height="120" style="width:120px;height:120px;object-fit:cover;border-radius:12px;display:block;" />
      </td>`
    : "";

  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
    <tr><td style="background-color:${u.cor_fundo};border-radius:16px;padding:24px;">
      <p style="margin:0 0 4px;font-size:20px;font-weight:800;color:${u.cor_headline};text-align:center;">${u.headline || ""}</p>
      <p style="margin:0 0 16px;font-size:13px;color:${u.cor_sub_headline};text-align:center;">${u.sub_headline || ""}</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          ${imageBlock}
          <td style="vertical-align:top;">
            <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:${u.cor_nome_produto};">${u.produto_nome || ""}</p>
            <p style="margin:0 0 8px;font-size:12px;color:${u.cor_descricao};line-height:1.4;">${u.produto_descricao || ""}</p>
            <p style="margin:0;font-size:18px;font-weight:800;color:${u.cor_valor};">${u.produto_valor || ""}</p>
          </td>
        </tr>
      </table>
      ${u.botao_url ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px auto 0;">
        <tr><td style="background-color:${u.cor_botao_bg};border-radius:50px;box-shadow:0 4px 16px ${u.cor_botao_bg}44;">
          <a href="${u.botao_url}" style="display:inline-block;color:${u.cor_botao_texto};text-decoration:none;padding:12px 36px;font-size:14px;font-weight:700;letter-spacing:0.3px;">${u.botao_texto || "Comprar Agora"}</a>
        </td></tr>
      </table>` : ""}
    </td></tr>
  </table>`;
}

function buildEmailHtml(
  evento: Record<string, unknown>,
  envio: Record<string, unknown>,
  extras: Record<string, string>,
  primaryColor = "#6366f1",
  appBaseUrl = "https://rastreio.jltransportelogistica.com",
  ctaColor = "#1a1a1a",
  postagemConfig?: Record<string, unknown>,
  upsellConfig?: UpsellConfig | null
): string {
  // --- Check for Taxação-specific settings ---
  const statusLabel = (evento.status_label as string) || "";
  const corpoEmail = (evento.corpo_email as string) || "";
  const taxSettings = (statusLabel === "Taxação") ? parseTaxacaoSettings(corpoEmail) : null;
  const falhaSettings = (statusLabel === "Falha Entrega") ? parseFalhaEntregaSettings(
    corpoEmail,
    (postagemConfig?.checkout_url_falha as string) || "",
    postagemConfig?.valor_taxa_falha as number | string | undefined
  ) : null;
  const envioId = (envio.id as string) || "";

  if (taxSettings) {
    return buildTaxacaoEmailHtml(envio, extras, taxSettings, envioId, appBaseUrl);
  }

  if (falhaSettings) {
    return buildFalhaEntregaEmailHtml(envio, extras, falhaSettings, appBaseUrl);
  }

  const enviarNfePdf = (evento.enviar_nfe_pdf as boolean) || false;
  const emoji = emojiMap[statusLabel] || "📬";

  let saudacao = `Olá {{cliente_nome}},`;
  let mensagem = (corpoEmail || `Atualização sobre o seu pedido **{{produto}}**.`).replace(/\{\{(?:falha|taxacao)_[^}]*\}\}/g, "").trim();
  let rodape = `Atenciosamente,\n{{empresa_nome}}`;
  let mostrarInfoPedido = true;
  let mostrarBotaoCta = true;
  let textoBotaoCta = "Rastrear Pedido";
  const codigoRastreio = (envio.codigo_rastreio as string) || "";
  let urlBotaoCta = codigoRastreio ? `${appBaseUrl}?c=${codigoRastreio}` : "#";

  // For Taxação status, always point the CTA to the payment page
  if (statusLabel === "Taxação" && envioId) {
    urlBotaoCta = `${appBaseUrl}?p=${envioId}`;
    textoBotaoCta = "PAGAR TAXA";
  }

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

  const transportadora = (envio.transportadora as string) || DEFAULT_TRANSPORTADORA;
  const saudacaoHtml = markdownToHtml(replaceVariables(saudacao, envio, extras));
  const mensagemHtml = markdownToHtml(replaceVariables(mensagem, envio, extras));
  const rodapeHtml = markdownToHtml(replaceVariables(rodape, envio, extras));
  const empresaNome = extras.empresa_nome || "Loja";
  const empresaLogoUrl = extras.empresa_logo_url || "";
  const produto = replaceVariables("{{produto}}", envio, extras);
  const rastreio = replaceVariables("{{codigo_rastreio}}", envio, extras);
  const valor = replaceVariables("{{valor}}", envio, extras);

  // Status-specific colors
  const statusColors: Record<string, { bg: string; text: string; accent: string }> = {
    "Postado": { bg: "#eef2ff", text: "#4f46e5", accent: "#6366f1" },
    "Pedido Confirmado": { bg: "#f0fdf4", text: "#16a34a", accent: "#22c55e" },
    "Nota Fiscal Emitida": { bg: "#fefce8", text: "#a16207", accent: "#eab308" },
    "Coletado": { bg: "#eff6ff", text: "#2563eb", accent: "#3b82f6" },
    "Em Trânsito": { bg: "#eff6ff", text: "#2563eb", accent: "#3b82f6" },
    "Em Rota": { bg: "#fef3c7", text: "#d97706", accent: "#f59e0b" },
    "Centro Local": { bg: "#f0f9ff", text: "#0284c7", accent: "#0ea5e9" },
    "Saiu para Entrega": { bg: "#fef9c3", text: "#ca8a04", accent: "#eab308" },
    "Entregue": { bg: "#dcfce7", text: "#15803d", accent: "#22c55e" },
    "Falha Entrega": { bg: "#fff7ed", text: "#9a3412", accent: "#ea580c" },
    "Pago": { bg: "#dcfce7", text: "#15803d", accent: "#22c55e" },
    "Reenvio Pago": { bg: "#dcfce7", text: "#15803d", accent: "#22c55e" },
    "Reenvio Saiu": { bg: "#eff6ff", text: "#2563eb", accent: "#3b82f6" },
  };
  const colors = statusColors[statusLabel] || { bg: "#f3f4f6", text: "#4b5563", accent: primaryColor };

  const titleMap: Record<string, string> = {
    "Postado": "Pedido Postado",
    "Nota Fiscal Emitida": "Nota Fiscal Emitida",
    "Pedido Confirmado": "Pedido Confirmado",
    "Coletado": "Pedido Coletado",
    "Em Trânsito": "Pedido em Trânsito",
    "Em Rota": "Em Rota de Entrega",
    "Centro Local": "Centro de Distribuição",
    "Saiu para Entrega": "Saiu para Entrega",
    "Entregue": "Pedido Entregue!",
    "Falha Entrega": "Falha na Entrega",
    "Taxação": "Aviso de Taxação",
    "Pago": "Pagamento Confirmado",
    "Reenvio Pago": "Reenvio Confirmado",
    "Reenvio Saiu": "Pedido Reenviado",
  };
  const headerTitle = enviarNfePdf
    ? "Nota Fiscal Emitida"
    : (titleMap[statusLabel] || statusLabel || "Atualização");

  // Logo — clean circular crop
  const logoHtml = empresaLogoUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 12px;">
        <tr><td style="width:72px;height:72px;border-radius:50%;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1);">
          <img src="${empresaLogoUrl}" alt="${empresaNome}" width="72" height="72" style="width:72px;height:72px;object-fit:cover;border-radius:50%;display:block;" />
        </td></tr>
      </table>`
    : "";

  // Status badge pill
  const badgeHtml = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
    <tr><td style="background-color:${colors.bg};color:${colors.text};font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;padding:6px 20px;border-radius:20px;">
      ${emoji} ${statusLabel || "Atualização"}
    </td></tr>
  </table>`;

  // Tracking code highlight
  const trackingBlock = rastreio && rastreio !== "{{codigo_rastreio}}"
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;">
        <tr><td style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;text-align:center;">
          <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Código de Rastreio</p>
          <p style="margin:0;font-size:20px;font-weight:800;color:${colors.accent};letter-spacing:1.5px;font-family:'Courier New',Courier,monospace;">${rastreio}</p>
        </td></tr>
      </table>`
    : "";

  // Info grid — 2-column clean cards
  const infoBlock = mostrarInfoPedido
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
        <tr>
          <td width="50%" style="padding-right:6px;vertical-align:top;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:12px;border:1px solid #f1f5f9;">
              <tr><td style="padding:14px 16px;">
                <p style="margin:0 0 2px;font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">📦 Produto</p>
                <p style="margin:0;font-size:13px;font-weight:600;color:#1e293b;line-height:1.4;">${produto}</p>
              </td></tr>
            </table>
          </td>
          <td width="50%" style="padding-left:6px;vertical-align:top;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:12px;border:1px solid #f1f5f9;">
              <tr><td style="padding:14px 16px;">
                <p style="margin:0 0 2px;font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">💰 Valor</p>
                <p style="margin:0;font-size:13px;font-weight:700;color:#1e293b;">R$ ${valor}</p>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr><td colspan="2" style="height:12px;"></td></tr>
        <tr>
          <td colspan="2">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:12px;border:1px solid #f1f5f9;">
              <tr><td style="padding:14px 16px;">
                <p style="margin:0 0 2px;font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">🚛 Transportadora</p>
                <p style="margin:0;font-size:13px;font-weight:600;color:#1e293b;">${transportadora}</p>
              </td></tr>
            </table>
          </td>
        </tr>
      </table>`
    : "";

  // CTA button with custom color
  const ctaBlock = mostrarBotaoCta && textoBotaoCta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 0;">
        <tr><td style="background-color:${ctaColor};border-radius:50px;box-shadow:0 4px 16px ${ctaColor}44;">
          <a href="${urlBotaoCta}" style="display:inline-block;color:#ffffff;text-decoration:none;padding:14px 44px;font-size:14px;font-weight:700;letter-spacing:0.3px;">${textoBotaoCta}</a>
        </td></tr>
      </table>`
    : "";

  // WhatsApp button
  const whatsappBlock = buildWhatsAppButton(extras.whatsapp_vendedor || "");

  // Special celebration block for "Entregue" with receiver/neighbor data
  let entregueBlock = "";
  if (statusLabel === "Entregue") {
    const recebedorNome = extras.recebedor_nome || "Maria Aparecida";
    const recebedorCpf = extras.recebedor_cpf || "***.234.567-**";
    const primeiroNome = extras.cliente_primeiro_nome || (envio.cliente_nome as string || "").split(" ")[0] || "Cliente";

    entregueBlock = `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;">
        <tr><td style="background:linear-gradient(135deg, #dcfce7, #f0fdf4);border-radius:16px;padding:24px;text-align:center;border:1px solid #bbf7d0;">
          <p style="margin:0 0 4px;font-size:32px;">🎉</p>
          <p style="margin:0 0 4px;font-size:16px;font-weight:800;color:#15803d;">Seu pedido foi entregue!</p>
          <p style="margin:0;font-size:13px;color:#166534;">Esperamos que você aproveite sua compra.</p>
        </td></tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 0;">
        <tr><td style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;">
          <p style="margin:0 0 2px;font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Dados do Recebedor</p>
          <p style="margin:8px 0 4px;font-size:14px;font-weight:700;color:#1e293b;">Recebedor: ${recebedorNome} <span style="font-weight:400;color:#64748b;">(Vizinho(a) de ${primeiroNome})</span></p>
          <p style="margin:0;font-size:13px;color:#64748b;">Documento: ${recebedorCpf}</p>
        </td></tr>
      </table>`;
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${headerTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">

      <!-- Main Card -->
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05),0 8px 32px rgba(0,0,0,0.08);">

        <!-- Logo + Brand -->
        <tr>
          <td style="padding:36px 40px 24px;text-align:center;">
            ${logoHtml}
            <p style="margin:0;color:#64748b;font-size:12px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">${empresaNome}</p>
          </td>
        </tr>

        <!-- Thin accent bar -->
        <tr>
          <td style="padding:0 40px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:3px;background:linear-gradient(90deg, ${colors.accent}, ${colors.accent}88);border-radius:3px;"></td></tr></table>
          </td>
        </tr>

        <!-- Status Badge + Title -->
        <tr>
          <td style="padding:28px 40px 0;text-align:center;">
            ${badgeHtml}
            <p style="margin:16px 0 0;font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;line-height:1.3;">${headerTitle}</p>
          </td>
        </tr>

        <!-- Body Content -->
        <tr>
          <td style="padding:24px 40px 0;">
            <!-- Separator -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="border-top:1px solid #f1f5f9;"></td></tr></table>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#334155;">${saudacaoHtml}</p>
            <div style="margin:0;font-size:14px;line-height:1.8;color:#475569;">${mensagemHtml}</div>
            ${entregueBlock}
            ${trackingBlock}
            ${infoBlock}
            ${ctaBlock}
            ${whatsappBlock}
            ${upsellConfig?.ativo ? buildUpsellHtml(upsellConfig) : ""}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:32px 40px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #f1f5f9;padding-top:20px;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;text-align:center;">${rodapeHtml}</p>
            </td></tr></table>
          </td>
        </tr>
      </table>

      <!-- Sub-footer -->
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td style="padding:16px 0;text-align:center;">
          <p style="margin:0;font-size:11px;color:#cbd5e1;">Enviado por ${empresaNome} • Rastreio automático</p>
        </td></tr>
      </table>

    </td></tr>
  </table>
</body>
</html>`;
}

/** Build a specialized Taxação email — premium design */
function buildTaxacaoEmailHtml(
  envio: Record<string, unknown>,
  extras: Record<string, string>,
  tax: TaxacaoSettings,
  envioId: string,
  appBaseUrl: string
): string {
  const empresaNome = extras.empresa_nome || "Loja";
  const empresaLogoUrl = extras.empresa_logo_url || "";
  const clienteNome = (envio.cliente_nome as string) || "Cliente";
  const valor = parseFloat(tax.valor_exemplo) || 0;
  const valorFormatted = valor.toFixed(2).replace(".", ",");
  const transportadora = (envio.transportadora as string) || DEFAULT_TRANSPORTADORA;
  const produto = replaceVariables("{{produto}}", envio, extras);
  const rastreio = replaceVariables("{{codigo_rastreio}}", envio, extras);
  const mensagem = replaceVariables(tax.mensagem_taxa, envio, extras);

  // Link to the public payment page instead of direct checkout
  const paymentPageUrl = `${appBaseUrl}?p=${envioId}`;

  const prazoHtml = tax.mostrar_prazo && tax.prazo_dias
    ? `<p style="margin:6px 0 0;font-size:11px;color:#78716c;">Prazo: ${tax.prazo_dias} dias para pagamento</p>`
    : "";

  const logoHtml = empresaLogoUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 12px;">
        <tr><td style="width:72px;height:72px;border-radius:50%;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1);">
          <img src="${empresaLogoUrl}" alt="${empresaNome}" width="72" height="72" style="width:72px;height:72px;object-fit:cover;border-radius:50%;display:block;" />
        </td></tr>
      </table>`
    : "";

  const valorHtml = tax.mostrar_valor
    ? `<p style="margin:0 0 2px;font-size:11px;color:#78716c;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Valor da taxa</p>
       <p style="margin:0 0 20px;font-size:32px;font-weight:800;color:#0f172a;letter-spacing:-1px;">R$ ${valorFormatted}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Taxa de Importação</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">

      <!-- Main Card -->
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05),0 8px 32px rgba(0,0,0,0.08);">

        <!-- Logo + Brand -->
        <tr>
          <td style="padding:36px 40px 24px;text-align:center;">
            ${logoHtml}
            <p style="margin:0;color:#64748b;font-size:12px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">${empresaNome}</p>
          </td>
        </tr>

        <!-- Warning accent bar -->
        <tr>
          <td style="padding:0 40px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:3px;background:linear-gradient(90deg, ${tax.cor_botao}, ${tax.cor_botao}88);border-radius:3px;"></td></tr></table>
          </td>
        </tr>

        <!-- Status Badge + Title -->
        <tr>
          <td style="padding:28px 40px 0;text-align:center;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr><td style="background-color:#fef3c7;color:#92400e;font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;padding:6px 20px;border-radius:20px;">
                ⚠️ Taxa de Importação
              </td></tr>
            </table>
            <p style="margin:16px 0 0;font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;">Pagamento Pendente</p>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:24px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;"><tr><td style="border-top:1px solid #f1f5f9;"></td></tr></table>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">Olá <strong>${clienteNome}</strong>,</p>
            <p style="margin:0 0 0;font-size:14px;line-height:1.7;color:#475569;">${mensagem}</p>
          </td>
        </tr>

        <!-- Tax Payment Card -->
        <tr>
          <td style="padding:24px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid ${tax.cor_botao};border-radius:16px;overflow:hidden;">
              <tr>
                <td style="background-color:#fffbeb;padding:28px 24px;text-align:center;">
                  ${valorHtml}
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                    <tr><td style="background-color:${tax.cor_botao};border-radius:50px;box-shadow:0 4px 16px ${tax.cor_botao}44;">
                      <a href="${paymentPageUrl}" style="display:inline-block;color:#ffffff;text-decoration:none;padding:14px 48px;font-size:15px;font-weight:800;letter-spacing:0.3px;">${tax.texto_botao}</a>
                    </td></tr>
                  </table>
                  ${prazoHtml}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Order Info -->
        <tr>
          <td style="padding:0 40px 8px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="50%" style="padding-right:6px;vertical-align:top;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:12px;border:1px solid #f1f5f9;">
                    <tr><td style="padding:14px 16px;">
                      <p style="margin:0 0 2px;font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">📦 Produto</p>
                      <p style="margin:0;font-size:13px;font-weight:600;color:#1e293b;line-height:1.4;">${produto}</p>
                    </td></tr>
                  </table>
                </td>
                <td width="50%" style="padding-left:6px;vertical-align:top;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:12px;border:1px solid #f1f5f9;">
                    <tr><td style="padding:14px 16px;">
                      <p style="margin:0 0 2px;font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">🚛 Transp.</p>
                      <p style="margin:0;font-size:13px;font-weight:600;color:#1e293b;">${transportadora}</p>
                    </td></tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Tracking Code -->
        <tr>
          <td style="padding:8px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:12px;border:1px solid #f1f5f9;">
              <tr><td style="padding:14px 16px;text-align:center;">
                <p style="margin:0 0 2px;font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">🔍 Rastreio</p>
                <p style="margin:0;font-size:16px;font-weight:800;color:${tax.cor_botao};letter-spacing:1px;font-family:'Courier New',Courier,monospace;">${rastreio}</p>
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- WhatsApp -->
        <tr><td style="padding:0 40px;text-align:center;">${buildWhatsAppButton(extras.whatsapp_vendedor || "")}</td></tr>

        <!-- Footer -->
        <tr>
          <td style="padding:32px 40px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #f1f5f9;padding-top:20px;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;text-align:center;">Atenciosamente,<br><strong>${empresaNome}</strong></p>
            </td></tr></table>
          </td>
        </tr>
      </table>

      <!-- Sub-footer -->
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td style="padding:16px 0;text-align:center;">
          <p style="margin:0;font-size:11px;color:#cbd5e1;">Enviado por ${empresaNome} • Rastreio automático</p>
        </td></tr>
      </table>

    </td></tr>
  </table>
</body>
</html>`;
}

/** Build a specialized Falha na Entrega email */
function buildFalhaEntregaEmailHtml(
  envio: Record<string, unknown>,
  extras: Record<string, string>,
  config: FalhaEntregaSettings,
  appBaseUrl: string
): string {
  const empresaNome = extras.empresa_nome || "Loja";
  const empresaLogoUrl = extras.empresa_logo_url || "";
  const clienteNome = (envio.cliente_nome as string) || "Cliente";
  const valor = parseFloat(config.valor_taxa_falha) || 0;
  const valorFormatted = valor.toFixed(2).replace(".", ",");
  const transportadora = (envio.transportadora as string) || DEFAULT_TRANSPORTADORA;
  const produto = replaceVariables("{{produto}}", envio, extras);
  const rastreio = replaceVariables("{{codigo_rastreio}}", envio, extras);
  const mensagem = replaceVariables(config.msg_falha_entrega, envio, extras);

  // Botão customizado vai para o checkout que o lojista definiu
  const paymentPageUrl = config.checkout_url_falha || appBaseUrl;
  const color = "#ea580c";

  const logoHtml = empresaLogoUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 12px;">
        <tr><td style="width:72px;height:72px;border-radius:50%;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1);">
          <img src="${empresaLogoUrl}" alt="${empresaNome}" width="72" height="72" style="width:72px;height:72px;object-fit:cover;border-radius:50%;display:block;" />
        </td></tr>
      </table>`
    : "";

  const valorHtml = valor > 0
    ? `<p style="margin:0 0 2px;font-size:11px;color:#78716c;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Taxa de Reenvio</p>
       <p style="margin:0 0 20px;font-size:32px;font-weight:800;color:#0f172a;letter-spacing:-1px;">R$ ${valorFormatted}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Aviso de Falha na Entrega</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">

      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05),0 8px 32px rgba(0,0,0,0.08);">
        <tr>
          <td style="padding:36px 40px 24px;text-align:center;">
            ${logoHtml}
            <p style="margin:0;color:#64748b;font-size:12px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">${empresaNome}</p>
          </td>
        </tr>

        <tr>
          <td style="padding:0 40px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:3px;background:linear-gradient(90deg, ${color}, ${color}88);border-radius:3px;"></td></tr></table>
          </td>
        </tr>

        <tr>
          <td style="padding:28px 40px 0;text-align:center;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr><td style="background-color:#fff7ed;color:#9a3412;font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;padding:6px 20px;border-radius:20px;">
                ❌ Falha na Entrega
              </td></tr>
            </table>
            <p style="margin:16px 0 0;font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;">Retorno ao Remetente</p>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;"><tr><td style="border-top:1px solid #f1f5f9;"></td></tr></table>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">Olá <strong>${clienteNome}</strong>,</p>
            <p style="margin:0 0 0;font-size:14px;line-height:1.7;color:#475569;">${mensagem}</p>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid ${color};border-radius:16px;overflow:hidden;">
              <tr>
                <td style="background-color:#fffbeb;padding:28px 24px;text-align:center;">
                  ${valorHtml}
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                    <tr><td style="background-color:${color};border-radius:50px;box-shadow:0 4px 16px ${color}44;">
                      <a href="${paymentPageUrl}" style="display:inline-block;color:#ffffff;text-decoration:none;padding:14px 48px;font-size:15px;font-weight:800;letter-spacing:0.3px;">PAGAR REENVIO / FRETE</a>
                    </td></tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:0 40px 8px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="50%" style="padding-right:6px;vertical-align:top;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:12px;border:1px solid #f1f5f9;">
                    <tr><td style="padding:14px 16px;">
                      <p style="margin:0 0 2px;font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">📦 Produto</p>
                      <p style="margin:0;font-size:13px;font-weight:600;color:#1e293b;line-height:1.4;">${produto}</p>
                    </td></tr>
                  </table>
                </td>
                <td width="50%" style="padding-left:6px;vertical-align:top;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:12px;border:1px solid #f1f5f9;">
                    <tr><td style="padding:14px 16px;">
                      <p style="margin:0 0 2px;font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">🚛 Transp.</p>
                      <p style="margin:0;font-size:13px;font-weight:600;color:#1e293b;">${transportadora}</p>
                    </td></tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:8px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:12px;border:1px solid #f1f5f9;">
              <tr><td style="padding:14px 16px;text-align:center;">
                <p style="margin:0 0 2px;font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">🔍 Rastreio</p>
                <p style="margin:0;font-size:16px;font-weight:800;color:${color};letter-spacing:1px;font-family:'Courier New',Courier,monospace;">${rastreio}</p>
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- WhatsApp -->
        <tr><td style="padding:0 40px;text-align:center;">${buildWhatsAppButton(extras.whatsapp_vendedor || "")}</td></tr>

        <tr>
          <td style="padding:32px 40px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #f1f5f9;padding-top:20px;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;text-align:center;">Atenciosamente,<br><strong>${empresaNome}</strong></p>
            </td></tr></table>
          </td>
        </tr>
      </table>

      <!-- Sub-footer -->
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td style="padding:16px 0;text-align:center;">
          <p style="margin:0;font-size:11px;color:#cbd5e1;">Enviado por ${empresaNome} • Rastreio automático</p>
        </td></tr>
      </table>

    </td></tr>
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

    // Check if called with service role key (server-to-server, e.g. cron)
    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === SUPABASE_SERVICE_ROLE_KEY;

    if (!isServiceRole) {
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
    } else {
      console.log("Authenticated via service role (server-to-server)");
    }

    const { envio_id, evento_id, loja_id, nfe_pdf_base64, nfe_storage_path, nfe_filename, generate_nfe_server } =
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

    // Fetch postagem_config for sender email + whatsapp
    let emailRemetente = "noreply@holdingtransportesbr.com";
    let whatsappVendedor = "";
    const isJadlog = envio.transportadora?.toUpperCase().includes("JADLOG");
    const isVetor = envio.transportadora?.toUpperCase().includes("VETOR");

    let corPrimaria = "#6366f1";
    let corBotaoCta = "#1a1a1a";

    const { data: config } = await supabase
      .from("postagem_config")
      .select("email_remetente, whatsapp_vendedor, cor_primaria, cor_botao_cta, checkout_url_falha, valor_taxa_falha, ativar_vizinho")
      .eq("loja_id", loja_id)
      .maybeSingle();

    if (config?.email_remetente) {
      emailRemetente = config.email_remetente;
    }
    if (config?.whatsapp_vendedor) {
      whatsappVendedor = config.whatsapp_vendedor;
    }
    if (config?.cor_primaria) {
      corPrimaria = config.cor_primaria;
    }
    if (config?.cor_botao_cta) {
      corBotaoCta = config.cor_botao_cta;
    }

    // Fetch empresa data
    let fromName = "Loja";
    let empresaLogoUrl = "";
    let empresaNome = "Loja";

    // Tentar por empresa_id primeiro
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

    // Fallback: buscar por loja_id se empresa_id nao existir ou nao retornou dados
    if (empresaNome === "Loja" && envio.loja_id) {
      const { data: empresa } = await supabase
        .from("empresas")
        .select("nome_fantasia, razao_social, logo_url")
        .eq("loja_id", envio.loja_id)
        .maybeSingle();
      if (empresa) {
        fromName = empresa.nome_fantasia || empresa.razao_social || "Loja";
        empresaNome = fromName;
        empresaLogoUrl = empresa.logo_url || "";
      }
    }

    const extras: Record<string, string> = {
      empresa_nome: empresaNome,
      empresa_logo_url: empresaLogoUrl,
      whatsapp_vendedor: whatsappVendedor,
    };

    // Add vizinho (neighbor) data for "Entregue" events — only if ativar_vizinho is enabled
    const statusLabel = (evento.status_label as string) || "";
    const ativarVizinho = config?.ativar_vizinho ?? true;
    if (statusLabel === "Entregue" && ativarVizinho) {
      const vizinhoExtras = getVizinhoExtras(envio.id, envio.cliente_nome || "");
      Object.assign(extras, vizinhoExtras);
    }

    // Build beautiful HTML email
    const subject = replaceVariables(
      evento.assunto_email || "Atualização do seu pedido",
      envio,
      extras
    );
    // Use redirect edge function as base URL so links never break if domain changes
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const appBaseUrl = `${supabaseUrl}/functions/v1/redirect`;

    const primaryColor = isJadlog ? "#e10526" : isVetor ? "#1B5E20" : corPrimaria;

    // Fetch upsell config if applicable (only for NF-e/Postado or Coletado events)
    let upsellData: UpsellConfig | null = null;
    let upsellCharged = false;
    const upsellTipoMap: Record<string, string> = {
      "Postado": "nfe",
      "Nota Fiscal Emitida": "nfe",
      "Coletado": "coletado",
    };
    const upsellTipo = upsellTipoMap[statusLabel] || null;
    if (upsellTipo) {
      const { data: upsellRow } = await supabase
        .from("upsell_config")
        .select("*")
        .eq("loja_id", loja_id)
        .eq("tipo", upsellTipo)
        .eq("ativo", true)
        .maybeSingle();
      if (upsellRow) {
        // Try to charge 0.10 moedas — get cost from system_config
        const { data: custoRow } = await supabase
          .from("system_config")
          .select("value")
          .eq("key", "custo_upsell_email")
          .maybeSingle();
        const custoUpsell = custoRow?.value ?? 0.10;

        // Get loja owner
        const { data: lojaRow } = await supabase
          .from("lojas")
          .select("user_id")
          .eq("id", loja_id)
          .single();

        if (lojaRow?.user_id) {
          const { data: debitOk } = await supabase.rpc("debit_user_credits", {
            _user_id: lojaRow.user_id,
            _quantidade: custoUpsell,
            _descricao: `Upsell no e-mail - ${statusLabel}`,
          });
          if (debitOk) {
            upsellData = upsellRow as unknown as UpsellConfig;
            upsellCharged = true;
            console.log("Upsell block included, charged", custoUpsell, "moedas");
          } else {
            console.warn("Insufficient credits for upsell, skipping block");
          }
        }
      }
    }

    const htmlBody = buildEmailHtml(evento, envio, extras, primaryColor, appBaseUrl, corBotaoCta, config || undefined, upsellData);

    // Resolve PDF attachment: prefer storage path, then server-side generation, fallback to inline base64
    let pdfBase64ForAttachment: string | undefined = nfe_pdf_base64;
    let resolvedNfeFilename = nfe_filename || "NF-e.pdf";

    if (nfe_storage_path) {
      console.log("Downloading PDF from storage:", nfe_storage_path);
      const { data: fileData, error: dlErr } = await supabase.storage
        .from("nfe-pdfs")
        .download(nfe_storage_path);

      if (dlErr || !fileData) {
        console.error("Failed to download PDF from storage:", dlErr);
      } else {
        const arrayBuffer = await fileData.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const chunkSize = 8192;
        let binary = "";
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, i + chunkSize);
          binary += String.fromCharCode(...chunk);
        }
        pdfBase64ForAttachment = btoa(binary);
        console.log("PDF downloaded from storage, size:", bytes.length);

        const { error: delErr } = await supabase.storage
          .from("nfe-pdfs")
          .remove([nfe_storage_path]);
        if (delErr) {
          console.error("Failed to cleanup PDF from storage:", delErr);
        }
      }
    } else if (generate_nfe_server && evento.enviar_nfe_pdf) {
      // Generate PDF server-side using pdf-lib (no html2canvas dependency)
      console.log("Generating DANFE PDF server-side for envio:", envio_id);
      try {
        let empresaForPdf = null;
        if (envio.empresa_id) {
          const { data: emp } = await supabase.from("empresas").select("*").eq("id", envio.empresa_id).single();
          empresaForPdf = emp;
        }
        if (!empresaForPdf && envio.loja_id) {
          const { data: emp } = await supabase.from("empresas").select("*").eq("loja_id", envio.loja_id).maybeSingle();
          empresaForPdf = emp;
        }

        if (empresaForPdf) {
          const pdfBytes = await generateDanfePdfServerSide(empresaForPdf, envio);
          const chunkSize = 8192;
          let binary = "";
          for (let i = 0; i < pdfBytes.length; i += chunkSize) {
            const chunk = pdfBytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode(...chunk);
          }
          pdfBase64ForAttachment = btoa(binary);
          resolvedNfeFilename = `DANFE_${Math.floor(Math.random() * 9000000000 + 1000000000)}.pdf`;
          console.log("DANFE PDF generated server-side, size:", pdfBytes.length);
        } else {
          console.warn("No empresa found for PDF generation, skipping attachment");
        }
      } catch (pdfErr) {
        console.error("Server-side PDF generation failed:", pdfErr);
      }
    }

    // Build attachments array
    const attachments = pdfBase64ForAttachment
      ? [{ filename: resolvedNfeFilename, content: pdfBase64ForAttachment }]
      : undefined;

    // Validate email before sending
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const recipientEmail = (envio.cliente_email || "").trim();

    if (!recipientEmail || !emailRegex.test(recipientEmail)) {
      console.warn("Invalid recipient email, skipping send:", recipientEmail);
      await supabase.from("postagem_email_log").insert({
        loja_id,
        envio_id,
        evento_id,
        destinatario: recipientEmail || "(vazio)",
        assunto: subject,
        status: "failed",
        custo: 0,
      });
      return new Response(
        JSON.stringify({ success: false, error: `E-mail do destinatário inválido: "${recipientEmail}"` }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email via Resend
    const resendBody: Record<string, unknown> = {
      from: `${fromName} <${emailRemetente}>`,
      to: [recipientEmail],
      subject,
      html: htmlBody,
    };
    if (attachments) {
      resendBody.attachments = attachments;
    }

    console.log("Sending email from:", resendBody.from, "to:", recipientEmail);

    // Resend free tier rate limit: 5 req/s. Retry on 429 with exponential backoff (max 4 tries).
    let resendResponse: Response;
    let resendData: any;
    let attempt = 0;
    const MAX_RETRIES = 4;
    while (true) {
      resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(resendBody),
      });
      resendData = await resendResponse.json().catch(() => ({}));

      if (resendResponse.status !== 429 || attempt >= MAX_RETRIES) break;

      // Exponential backoff: 400ms, 800ms, 1600ms, 3200ms
      const delayMs = 400 * Math.pow(2, attempt);
      console.warn(`Resend 429 rate limit, retry ${attempt + 1}/${MAX_RETRIES} after ${delayMs}ms`);
      await new Promise((r) => setTimeout(r, delayMs));
      attempt++;
    }

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
      custo: 0.0021,
      resend_email_id: resendData.id || null,
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
