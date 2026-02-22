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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresa: EmpresaData;
  envio?: EnvioData;
}

function formatCurrency(val: number) {
  return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function buildDanfeHtml(empresa: EmpresaData, envio: EnvioData): string {
  const e = empresa;
  const c = envio;
  const now = new Date();
  const dataEmissao = now.toLocaleDateString("pt-BR");
  const horaEmissao = now.toLocaleTimeString("pt-BR");
  const endEmpresa = [e.endereco, e.numero ? `${e.numero}` : ""].filter(Boolean).join(", ");
  const endEmpresa2 = [e.bairro, e.cep ? `CEP ${e.cep}` : ""].filter(Boolean).join(" - ");
  const endEmpresa3 = [e.cidade, e.estado].filter(Boolean).join(" - ");
  const valorUnit = c.valor || 0;
  const qtd = c.quantidade || 1;
  const valorTotal = valorUnit * qtd;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; font-size: 8pt; background: white; padding: 10px; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    td, th { border: 1px solid #000; padding: 3px 5px; vertical-align: top; overflow: hidden; word-wrap: break-word; }
    .label { font-size: 6pt; color: #333; font-weight: normal; }
    .value { font-size: 9pt; font-weight: bold; }
    .section-title { background: #f5f5f5; font-weight: bold; font-size: 8pt; padding: 3px 5px; }
    .center { text-align: center; }
    .right { text-align: right; }
    .barcode { background: #000; height: 50px; margin: 5px 0; }
    .danfe-title { font-size: 16pt; font-weight: bold; }
    .empresa-value { color: #2563eb; }
    @media print {
      @page { size: A4; margin: 10mm; }
      body { padding: 0; }
      .empresa-value { color: #000 !important; }
    }
  </style>
</head>
<body>
  <table style="border: 2px solid #000;">
    <!-- Recebemos -->
    <tr>
      <td colspan="6" style="font-size: 7pt; padding: 5px;">
        Recebemos de <strong>${e.razao_social || "EMPRESA"}</strong> os produtos e serviços constantes da Nota Fiscal Eletrônica indicada ao lado.<br>
        Emissão: ${dataEmissao} &nbsp;&nbsp; Valor Total: <strong>R$ ${formatCurrency(valorTotal)}</strong>
      </td>
      <td style="width: 120px; text-align: center; font-weight: bold;">
        NF-e<br>
        N° 000.000.001<br>
        Série 001
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
        N° 000.000.001<br>
        Série 001
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
        <div style="font-size: 9pt; font-weight: bold; margin-top: 5px;">N° 000.000.001<br>SÉRIE 001<br>FOLHA 1/1</div>
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
        <div class="label">NATUREZA DA OPERAÇÃO</div>
        <div class="value">VENDA DE MERCADORIA ADQUIRIDA OU RECEBIDA DE TERCEIROS</div>
      </td>
      <td colspan="2">
        <div class="label">PROTOCOLO DE AUTORIZAÇÃO DE USO</div>
        <div style="font-size: 7pt; font-weight: bold;">NFe com Autorização de Uso da SEFAZ</div>
      </td>
    </tr>

    <!-- Inscrições -->
    <tr>
      <td colspan="2">
        <div class="label">INSCRIÇÃO ESTADUAL</div>
        <div class="value"><span class="empresa-value">${e.inscricao_estadual || ""}</span></div>
      </td>
      <td colspan="2">
        <div class="label">INSC.ESTADUAL DO SUBST.TRIBUTÁRIA</div>
        <div class="value"></div>
      </td>
      <td colspan="3">
        <div class="label">CNPJ</div>
        <div class="value"><span class="empresa-value">${e.cnpj || ""}</span></div>
      </td>
    </tr>

    <!-- Destinatário Header -->
    <tr>
      <td colspan="7" class="section-title">DESTINATÁRIO / REMETENTE</td>
    </tr>

    <tr>
      <td colspan="4">
        <div class="label">NOME/RAZÃO SOCIAL</div>
        <div class="value">${c.cliente_nome || "Cliente Exemplo"}</div>
      </td>
      <td colspan="2">
        <div class="label">CNPJ/CPF</div>
        <div class="value">${c.cliente_cpf || "000.000.000-00"}</div>
      </td>
      <td>
        <div class="label">DATA DA EMISSÃO</div>
        <div class="value">${dataEmissao}</div>
      </td>
    </tr>

    <tr>
      <td colspan="3">
        <div class="label">ENDEREÇO</div>
        <div class="value">${[c.cliente_endereco, c.cliente_numero].filter(Boolean).join(", ") || "Rua Exemplo, 123"}</div>
      </td>
      <td colspan="2">
        <div class="label">BAIRRO/DISTRITO</div>
        <div class="value">${c.cliente_bairro || "Centro"}</div>
      </td>
      <td>
        <div class="label">CEP</div>
        <div class="value">${c.cliente_cep || "00000-000"}</div>
      </td>
      <td>
        <div class="label">DATA SAÍDA</div>
        <div class="value">${dataEmissao}</div>
      </td>
    </tr>

    <tr>
      <td colspan="2">
        <div class="label">MUNICÍPIO</div>
        <div class="value">${c.cliente_cidade || "São Paulo"}</div>
      </td>
      <td>
        <div class="label">FONE/FAX</div>
        <div class="value">${c.cliente_telefone || ""}</div>
      </td>
      <td>
        <div class="label">UF</div>
        <div class="value">${c.cliente_estado || "SP"}</div>
      </td>
      <td>
        <div class="label">INSCRIÇÃO ESTADUAL</div>
        <div class="value"></div>
      </td>
      <td colspan="2">
        <div class="label">HORA DA SAÍDA</div>
        <div class="value">${horaEmissao}</div>
      </td>
    </tr>

    <!-- Cálculo do Imposto -->
    <tr>
      <td colspan="7" class="section-title">CÁLCULO DO IMPOSTO</td>
    </tr>
    <tr>
      <td><div class="label">BASE CÁLC. ICMS</div><div class="value">0,00</div></td>
      <td><div class="label">VALOR DO ICMS</div><div class="value">0,00</div></td>
      <td><div class="label">BASE CÁLC. ICMS ST</div><div class="value">0,00</div></td>
      <td><div class="label">VALOR DO ICMS ST</div><div class="value">0,00</div></td>
      <td colspan="3"><div class="label">VALOR TOTAL DOS PRODUTOS</div><div class="value">R$ ${formatCurrency(valorTotal)}</div></td>
    </tr>
    <tr>
      <td><div class="label">VALOR DO FRETE</div><div class="value">0,00</div></td>
      <td><div class="label">VALOR DO SEGURO</div><div class="value">0,00</div></td>
      <td><div class="label">DESCONTO</div><div class="value">0,00</div></td>
      <td><div class="label">OUTRAS DESPESAS</div><div class="value">0,00</div></td>
      <td><div class="label">VALOR DO IPI</div><div class="value">0,00</div></td>
      <td colspan="2"><div class="label">VALOR TOTAL DA NOTA</div><div class="value">R$ ${formatCurrency(valorTotal)}</div></td>
    </tr>

    <!-- Transportador -->
    <tr>
      <td colspan="7" class="section-title">TRANSPORTADOR / VOLUMES TRANSPORTADOS</td>
    </tr>
    <tr>
      <td colspan="2"><div class="label">RAZÃO SOCIAL</div><div class="value">Trans Prada Zibe Transportes e Logistica LTDA</div></td>
      <td><div class="label">FRETE POR CONTA</div><div class="value">0 - REMETENTE</div></td>
      <td><div class="label">CÓDIGO ANTT</div><div class="value"></div></td>
      <td><div class="label">PLACA DO VEÍCULO</div><div class="value">FOD9C97</div></td>
      <td><div class="label">UF</div><div class="value">SP</div></td>
      <td><div class="label">CNPJ / CPF</div><div class="value">45.706.927/0001-80</div></td>
    </tr>
    <tr>
      <td colspan="3"><div class="label">ENDEREÇO</div><div class="value">Rua Aristeu, 248</div></td>
      <td colspan="2"><div class="label">MUNICÍPIO</div><div class="value">São Paulo</div></td>
      <td><div class="label">UF</div><div class="value">SP</div></td>
      <td><div class="label">INSCRIÇÃO ESTADUAL</div><div class="value">134.607.799.115</div></td>
    </tr>

    <!-- Produtos -->
    <tr>
      <td colspan="7" class="section-title">DADOS DOS PRODUTOS / SERVIÇOS</td>
    </tr>
    <tr style="font-size: 6pt; font-weight: bold; text-align: center;">
      <td>CÓDIGO</td>
      <td>DESCRIÇÃO DO PRODUTO</td>
      <td>NCM/SH</td>
      <td>CFOP</td>
      <td>UNID.</td>
      <td>VALOR UNIT.</td>
      <td>VALOR TOTAL</td>
    </tr>
    <tr style="text-align: center;">
      <td>1</td>
      <td style="text-align: left;">${c.produto || "Produto"}</td>
      <td>${c.ncm_sh || "00000000"}</td>
      <td>${c.cfop || "5102"}</td>
      <td>${c.unidade || "UN"}</td>
      <td>R$ ${formatCurrency(valorUnit)}</td>
      <td><strong>R$ ${formatCurrency(valorTotal)}</strong></td>
    </tr>

    <!-- Dados Adicionais -->
    <tr>
      <td colspan="7" class="section-title">DADOS ADICIONAIS</td>
    </tr>
    <tr>
      <td colspan="4" style="height: 60px;">
        <div class="label" style="font-weight: bold;">INFORMAÇÕES COMPLEMENTARES</div>
        <div style="font-size: 7pt; margin-top: 3px;">
          Documento emitido por ME ou EPP optante pelo Simples Nacional.<br>
          Não gera direito a crédito fiscal de IPI.
        </div>
      </td>
      <td colspan="3">
        <div class="label" style="font-weight: bold;">RESERVADO AO FISCO</div>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td colspan="7" class="right" style="font-size: 7pt; border: none;">
        DATA E HORA DA IMPRESSÃO: ${dataEmissao} ${horaEmissao}
      </td>
    </tr>
  </table>
</body>
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
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    const body = iframe.contentWindow.document.body;
    // Force black color before capture
    const empresaSpans = iframe.contentWindow.document.querySelectorAll('.empresa-value');
    empresaSpans.forEach((el: any) => { el.style.color = '#000'; });
    const { default: html2canvas } = await import("html2canvas");
    const { default: jsPDF } = await import("jspdf");
    const canvas = await html2canvas(body, { scale: 2, useCORS: true, backgroundColor: "#fff" });
    // Restore blue after capture
    empresaSpans.forEach((el: any) => { el.style.color = ''; });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = (canvas.height * pdfW) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
    pdf.save(`DANFE_${empresa.razao_social || "empresa"}.pdf`);
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
