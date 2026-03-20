import { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import jsPDF from "jspdf";

export interface EmpresaData {
  razao_social: string;
  nome_fantasia?: string;
  cnpj: string;
  inscricao_estadual?: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  telefone?: string;
  email?: string;
  logo_url?: string;
}

export interface ProductItem {
  codigo?: number;
  nome: string;
  quantidade: number;
  valor: number;
  cfop?: string | null;
  ncm_sh?: string | null;
  cst?: string | null;
  unidade?: string | null;
}

export interface EnvioData {
  cliente_nome?: string;
  cliente_cpf?: string;
  cliente_endereco?: string;
  cliente_numero?: string;
  cliente_bairro?: string;
  cliente_cidade?: string;
  cliente_estado?: string;
  cliente_cep?: string;
  cliente_telefone?: string;
  produto?: string;
  quantidade?: number;
  valor?: number;
  cfop?: string;
  ncm_sh?: string;
  cst?: string;
  unidade?: string;
}

/** Parse the produto field: if it's a JSON array, return structured items; otherwise single item */
function parseProductItems(envio: EnvioData): ProductItem[] {
  const raw = envio.produto || "";
  if (raw.startsWith("[")) {
    try {
      const items = JSON.parse(raw) as ProductItem[];
      if (Array.isArray(items) && items.length > 0) {
        // Webhooks store only { nome, quantidade } without valor per item.
        // If no item has a valor, distribute the envio total evenly across items.
        const hasAnyValor = items.some(i => i.valor && i.valor > 0);
        if (!hasAnyValor && envio.valor && envio.valor > 0) {
          const totalQty = items.reduce((s, i) => s + (i.quantidade || 1), 0);
          items.forEach(i => {
            i.valor = envio.valor! / totalQty;
          });
        }
        // Inherit fiscal fields from envio when not set per item
        return items.map((item, idx) => ({
          codigo: item.codigo || idx + 1,
          nome: item.nome || "Produto",
          quantidade: item.quantidade || 1,
          valor: item.valor || 0,
          cfop: item.cfop || envio.cfop,
          ncm_sh: item.ncm_sh || envio.ncm_sh,
          cst: item.cst || envio.cst,
          unidade: item.unidade || envio.unidade,
        }));
      }
    } catch { /* fallthrough */ }
  }
  // Single product (backward compatible)
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresa: EmpresaData;
  envio?: EnvioData;
}

function formatCurrency(val: number) {
  return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function getDanfeCssAndBody(empresa: EmpresaData, envio: EnvioData): { css: string; body: string } {
  const e = empresa;
  const c = envio;
  const now = new Date();
  const dataEmissao = now.toLocaleDateString("pt-BR");
  const horaEmissao = now.toLocaleTimeString("pt-BR");
  const endEmpresa = [e.endereco, e.numero ? `${e.numero}` : ""].filter(Boolean).join(", ");
  const endEmpresa2 = [e.bairro, e.cep ? `CEP ${e.cep}` : ""].filter(Boolean).join(" - ");
  const endEmpresa3 = [e.cidade, e.estado].filter(Boolean).join(" - ");
  const nfNumero = String(Math.floor(Math.random() * 999999) + 1).padStart(9, "0").replace(/(\d{3})(\d{3})(\d{3})/, "$1.$2.$3");
  const nfSerie = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");

  // Parse products (single or multi)
  const productItems = parseProductItems(c);
  const valorTotal = productItems.reduce((sum, item) => sum + (item.valor || 0) * (item.quantidade || 1), 0);

  const css = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    .danfe-root { font-family: 'Courier New', monospace; font-size: 8pt; background: white; padding: 10px; width: 700px; color: #000; }
    .danfe-root table { border-collapse: collapse; width: 680px; }
    .danfe-root td, .danfe-root th { border: 1px solid #000; padding: 3px 5px 4px 5px; vertical-align: top; overflow: visible; overflow-wrap: break-word; word-wrap: break-word; line-height: 1.4; }
    .danfe-root .truncate-cell { white-space: normal; overflow: visible; word-wrap: break-word; }
    .danfe-root .label { font-size: 6pt; color: #000; font-weight: normal; line-height: 1.3; }
    .danfe-root .value { font-size: 9pt; font-weight: bold; line-height: 1.4; }
    .danfe-root .section-title { background: #f5f5f5; font-weight: bold; font-size: 8pt; padding: 3px 5px; }
    .danfe-root .center { text-align: center; }
    .danfe-root .right { text-align: right; }
    .danfe-root .barcode { background: #000; height: 50px; margin: 5px 0; }
    .danfe-root .danfe-title { font-size: 16pt; font-weight: bold; }
    .danfe-root .empresa-value { color: #000; }
  `;

  const body = `<div class="danfe-root">
  <table style="border: 2px solid #000;">
    <!-- Recebemos -->
    <tr>
      <td colspan="6" style="font-size: 7pt; padding: 5px;">
        Recebemos de <strong>${e.razao_social || "EMPRESA"}</strong> os produtos e serviços constantes da Nota Fiscal Eletrônica indicada ao lado.<br>
        Emissão: ${dataEmissao} &nbsp;&nbsp; Valor Total: <strong>R$ ${formatCurrency(valorTotal)}</strong>
      </td>
      <td style="width: 120px; text-align: center; font-weight: bold;">
        NF-e<br>
        N° ${nfNumero}<br>
        Série ${nfSerie}
      </td>
    </tr>

    <!-- Data Recebimento -->
    <tr>
      <td colspan="6" style="font-size: 7pt; height: 40px;">
        <strong>DATA DO RECEBIMENTO</strong><br><br>
        IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR
      </td>
      <td style="width: 120px; text-align: center; font-weight: bold;">
        NF-e<br>
        N° ${nfNumero}<br>
        Série ${nfSerie}
      </td>
    </tr>

    <!-- Cabeçalho Principal -->
    <tr>
      <td colspan="2" style="width: 35%;">
        <div style="text-align: center; font-size: 11pt; font-weight: bold; margin-bottom: 5px;">
          <span class="empresa-value">${e.razao_social || "RAZÃO SOCIAL"}</span>
        </div>
        <div style="text-align: center; font-size: 7pt; line-height: 1.4;">
          <span class="empresa-value">${endEmpresa}</span><br>
          <span class="empresa-value">${endEmpresa2}</span><br>
          <span class="empresa-value">${endEmpresa3}</span><br>
          Fone: <span class="empresa-value">${e.telefone || "-"}</span><br>
          <span class="empresa-value">${e.email || ""}</span>
        </div>
      </td>
      <td colspan="2" style="width: 25%; text-align: center;">
        <div class="danfe-title">DANFE</div>
        <div style="font-size: 6pt; margin: 5px 0;">Documento Auxiliar da<br>Nota Fiscal Eletrônica</div>
        <div style="display: inline-block; border: 1px solid #000; padding: 2px 15px; font-size: 12pt; font-weight: bold; margin: 5px 0;">1</div>
        <div style="font-size: 6pt;">0 - ENTRADA &nbsp; 1 - SAÍDA</div>
        <div style="font-size: 9pt; font-weight: bold; margin-top: 5px;">N° ${nfNumero}<br>SÉRIE ${nfSerie}<br>FOLHA 1/1</div>
      </td>
      <td colspan="3" style="text-align: center;">
        <div class="barcode"></div>
        <div style="font-size: 8pt; font-weight: bold; letter-spacing: 1px;">3525 0612 3456 7800 0190 5500 1000 0000 0110 0000 0001</div>
        <div style="font-size: 6pt; margin-top: 3px;">
          Consulta de autenticidade no portal nacional da NF-e<br>
          www.nfe.fazenda.gov.br/portal
        </div>
      </td>
    </tr>

    <!-- Natureza da Operação -->
    <tr>
      <td colspan="5">
        <span class="label">NATUREZA DA OPERAÇÃO</span><br>
        <span class="value">VENDA DE MERCADORIA ADQUIRIDA OU RECEBIDA DE TERCEIROS</span>
      </td>
      <td colspan="2">
        <span class="label">PROTOCOLO DE AUTORIZAÇÃO DE USO</span><br>
        <span style="font-size: 7pt; font-weight: bold;">NFe com Autorização de Uso da SEFAZ</span>
      </td>
    </tr>

    <!-- Inscrições -->
    <tr>
      <td colspan="2">
        <span class="label">INSCRIÇÃO ESTADUAL</span><br>
        <span class="value"><span class="empresa-value">${e.inscricao_estadual || ""}</span></span>
      </td>
      <td colspan="2">
        <span class="label">INSC.ESTADUAL DO SUBST.TRIBUTÁRIA</span><br>
        <span class="value"></span>
      </td>
      <td colspan="3">
        <span class="label">CNPJ</span><br>
        <span class="value"><span class="empresa-value">${e.cnpj || ""}</span></span>
      </td>
    </tr>

    <!-- Destinatário Header -->
    <tr>
      <td colspan="8" class="section-title">DESTINATÁRIO / REMETENTE</td>
    </tr>

    <tr>
      <td colspan="4">
        <span class="label">NOME/RAZÃO SOCIAL</span><br>
        <span class="value">${c.cliente_nome || "Cliente Exemplo"}</span>
      </td>
      <td colspan="2">
        <span class="label">CNPJ/CPF</span><br>
        <span class="value">${c.cliente_cpf || "000.000.000-00"}</span>
      </td>
      <td>
        <span class="label">DATA DA EMISSÃO</span><br>
        <span class="value">${dataEmissao}</span>
      </td>
    </tr>

    <tr>
      <td colspan="3">
        <span class="label">ENDEREÇO</span><br>
        <span class="value">${[c.cliente_endereco, c.cliente_numero].filter(Boolean).join(", ") || "Rua Exemplo, 123"}</span>
      </td>
      <td colspan="2">
        <span class="label">BAIRRO/DISTRITO</span><br>
        <span class="value">${c.cliente_bairro || "Centro"}</span>
      </td>
      <td>
        <span class="label">CEP</span><br>
        <span class="value">${c.cliente_cep || "00000-000"}</span>
      </td>
      <td>
        <span class="label">DATA SAÍDA</span><br>
        <span class="value">${dataEmissao}</span>
      </td>
    </tr>

    <tr>
      <td colspan="2">
        <span class="label">MUNICÍPIO</span><br>
        <span class="value">${c.cliente_cidade || "São Paulo"}</span>
      </td>
      <td>
        <span class="label">FONE/FAX</span><br>
        <span class="value">${c.cliente_telefone || ""}</span>
      </td>
      <td>
        <span class="label">UF</span><br>
        <span class="value">${c.cliente_estado || "SP"}</span>
      </td>
      <td>
        <span class="label">INSCRIÇÃO ESTADUAL</span><br>
        <span class="value"></span>
      </td>
      <td colspan="2">
        <span class="label">HORA DA SAÍDA</span><br>
        <span class="value">${horaEmissao}</span>
      </td>
    </tr>

    <!-- Cálculo do Imposto -->
    <tr>
      <td colspan="8" class="section-title">CÁLCULO DO IMPOSTO</td>
    </tr>
    <tr>
      <td><span class="label">BASE CÁLC. ICMS</span><br><span class="value">0,00</span></td>
      <td><span class="label">VALOR DO ICMS</span><br><span class="value">0,00</span></td>
      <td><span class="label">BASE CÁLC. ICMS ST</span><br><span class="value">0,00</span></td>
      <td><span class="label">VALOR DO ICMS ST</span><br><span class="value">0,00</span></td>
      <td colspan="3"><span class="label">VALOR TOTAL DOS PRODUTOS</span><br><span class="value">R$ ${formatCurrency(valorTotal)}</span></td>
    </tr>
    <tr>
      <td><span class="label">VALOR DO FRETE</span><br><span class="value">0,00</span></td>
      <td><span class="label">VALOR DO SEGURO</span><br><span class="value">0,00</span></td>
      <td><span class="label">DESCONTO</span><br><span class="value">0,00</span></td>
      <td><span class="label">OUTRAS DESPESAS</span><br><span class="value">0,00</span></td>
      <td><span class="label">VALOR DO IPI</span><br><span class="value">0,00</span></td>
      <td colspan="2"><span class="label">VALOR TOTAL DA NOTA</span><br><span class="value">R$ ${formatCurrency(valorTotal)}</span></td>
    </tr>

    <!-- Transportador -->
    <tr>
      <td colspan="8" class="section-title">TRANSPORTADOR / VOLUMES TRANSPORTADOS</td>
    </tr>
    <tr>
      <td colspan="2"><span class="label">RAZÃO SOCIAL</span><br><span class="value truncate-cell">JL Transportes de Cargas LTDA</span></td>
      <td><span class="label">FRETE POR CONTA</span><br><span class="value">0 - REMETENTE</span></td>
      <td><span class="label">CÓDIGO ANTT</span><br><span class="value"></span></td>
      <td><span class="label">PLACA DO VEÍCULO</span><br><span class="value">FOD9C97</span></td>
      <td><span class="label">UF</span><br><span class="value">SP</span></td>
      <td><span class="label">CNPJ / CPF</span><br><span class="value">00.320.378/0001-72</span></td>
    </tr>
    <tr>
      <td colspan="3"><span class="label">ENDEREÇO</span><br><span class="value">Rua Aristeu, 248</span></td>
      <td colspan="2"><span class="label">MUNICÍPIO</span><br><span class="value">São Paulo</span></td>
      <td><span class="label">UF</span><br><span class="value">SP</span></td>
      <td><span class="label">INSCRIÇÃO ESTADUAL</span><br><span class="value">134.607.799.115</span></td>
    </tr>

    <!-- Produtos -->
    <tr>
      <td colspan="8" class="section-title">DADOS DOS PRODUTOS / SERVIÇOS</td>
    </tr>
    <tr style="font-size: 6pt; font-weight: bold; text-align: center;">
      <td>CÓDIGO</td>
      <td>DESCRIÇÃO DO PRODUTO</td>
      <td>NCM/SH</td>
      <td>CST</td>
      <td>CFOP</td>
      <td>UNID.</td>
      <td>VALOR UNIT.</td>
      <td>VALOR TOTAL</td>
    </tr>
    ${productItems.map((item, idx) => {
    const itemQty = item.quantidade || 1;
    const itemUnit = item.valor || 0;
    const itemTotal = itemUnit * itemQty;
    return `<tr style="text-align: center;">
      <td>${item.codigo || idx + 1}</td>
      <td style="text-align: left;">${item.nome || "Produto"}</td>
      <td>${item.ncm_sh || "00000000"}</td>
      <td>${item.cst || "000"}</td>
      <td>${item.cfop || "5102"}</td>
      <td>${item.unidade || "UN"}</td>
      <td>R$ ${formatCurrency(itemUnit)}</td>
      <td><strong>R$ ${formatCurrency(itemTotal)}</strong></td>
    </tr>`;
  }).join("\n")}

    <!-- Dados Adicionais -->
    <tr>
      <td colspan="8" class="section-title">DADOS ADICIONAIS</td>
    </tr>
    <tr>
      <td colspan="4" style="height: 60px;">
        <span class="label" style="font-weight: bold;">INFORMAÇÕES COMPLEMENTARES</span><br>
        <span style="font-size: 7pt;">
          Documento emitido por ME ou EPP optante pelo Simples Nacional.<br>
          Não gera direito a crédito fiscal de IPI.
        </span>
      </td>
      <td colspan="3">
        <span class="label" style="font-weight: bold;">RESERVADO AO FISCO</span>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td colspan="8" class="right" style="font-size: 7pt; border: none;">
        DATA E HORA DA IMPRESSÃO: ${dataEmissao} ${horaEmissao}
      </td>
    </tr>
  </table>
</div>`;

  return { css, body };
}

export function buildDanfeHtml(empresa: EmpresaData, envio: EnvioData): string {
  const { css, body } = getDanfeCssAndBody(empresa, envio);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${css}
    body { margin: 0; padding: 0; }
    @media print {
      @page { size: A4; margin: 10mm; }
      .danfe-root .empresa-value { color: #000 !important; }
    }
  </style>
</head>
<body>${body}</body>
</html>`;
}

export function DanfePreview({ open, onOpenChange, empresa, envio }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const defaultEnvio: EnvioData = {
    cliente_nome: "Cliente Exemplo",
    cliente_cpf: "000.000.000-00",
    cliente_endereco: "Rua Exemplo",
    cliente_numero: "123",
    cliente_bairro: "Centro",
    cliente_cidade: "São Paulo",
    cliente_estado: "SP",
    cliente_cep: "00000-000",
    produto: "Produto Exemplo",
    quantidade: 1,
    valor: 0,
    cfop: "5102",
    ncm_sh: "00000000",
    unidade: "UN",
  };

  const envioData = envio || defaultEnvio;
  const htmlContent = buildDanfeHtml(empresa, envioData);

  const handleDownload = async () => {
    const { css, body } = getDanfeCssAndBody(empresa, envioData);
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-9999px;top:0;width:700px;overflow:visible;';
    container.innerHTML = `<style>${css}</style>${body}`;
    document.body.appendChild(container);

    // Style is already black, no override needed

    await new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(resolve, 100);
        });
      });
    });

    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(container, {
      scale: 2, useCORS: true, backgroundColor: '#fff',
      width: 700, windowWidth: 700,
      height: container.scrollHeight,
    });

    const { default: jsPDF } = await import("jspdf");
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const ratio = canvas.width / canvas.height;
    let w = pdfW, h = pdfW / ratio;
    if (h > pdfH) { h = pdfH; w = pdfH * ratio; }
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h);
    const part1 = Math.floor(Math.random() * 9000000000 + 1000000000).toString();
    pdf.save(`DANFE_${part1}.pdf`);

    document.body.removeChild(container);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pré-visualização do NFE</DialogTitle>
        </DialogHeader>
        <iframe
          ref={iframeRef}
          srcDoc={htmlContent}
          title="DANFE Preview"
          style={{ width: "100%", height: 900, border: "none", background: "#fff" }}
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Baixar PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
