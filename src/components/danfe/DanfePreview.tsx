import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import jsPDF from "jspdf";

interface EmpresaData {
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresa: EmpresaData;
}

export function DanfePreview({ open, onOpenChange, empresa }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const enderecoCompleto = [
    empresa.endereco,
    empresa.numero ? `Nº ${empresa.numero}` : "",
    empresa.bairro,
    empresa.cidade,
    empresa.estado,
    empresa.cep ? `CEP: ${empresa.cep}` : "",
  ]
    .filter(Boolean)
    .join(", ");

  useEffect(() => {
    if (!open || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 595; // A4 width in points
    const H = 842; // A4 height in points
    canvas.width = W;
    canvas.height = H;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;

    let y = 20;

    // --- HEADER ---
    ctx.strokeRect(20, y, W - 40, 90);

    // Company info (left)
    ctx.font = "bold 11px Arial";
    ctx.fillStyle = "#000";
    ctx.fillText(empresa.razao_social || "RAZÃO SOCIAL DA EMPRESA", 30, y + 18);
    ctx.font = "9px Arial";
    if (empresa.nome_fantasia) ctx.fillText(empresa.nome_fantasia, 30, y + 32);
    ctx.fillText(enderecoCompleto || "Endereço da empresa", 30, y + 46);
    ctx.fillText(`CNPJ: ${empresa.cnpj || "00.000.000/0000-00"}`, 30, y + 60);
    if (empresa.inscricao_estadual) ctx.fillText(`IE: ${empresa.inscricao_estadual}`, 200, y + 60);
    if (empresa.telefone) ctx.fillText(`Tel: ${empresa.telefone}`, 30, y + 74);
    if (empresa.email) ctx.fillText(`Email: ${empresa.email}`, 200, y + 74);

    // DANFE label (right)
    ctx.strokeRect(W - 200, y, 180, 90);
    ctx.font = "bold 14px Arial";
    ctx.fillText("DANFE", W - 155, y + 25);
    ctx.font = "7px Arial";
    ctx.fillText("Documento Auxiliar da", W - 175, y + 40);
    ctx.fillText("Nota Fiscal Eletrônica", W - 173, y + 50);
    ctx.font = "bold 10px Arial";
    ctx.fillText("0 - ENTRADA", W - 175, y + 68);
    ctx.fillText("1 - SAÍDA", W - 175, y + 80);

    y += 100;

    // --- CHAVE DE ACESSO ---
    ctx.strokeRect(20, y, W - 40, 28);
    ctx.font = "7px Arial";
    ctx.fillText("CHAVE DE ACESSO", 30, y + 10);
    ctx.font = "9px Arial";
    ctx.fillText("0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000", 30, y + 22);
    y += 34;

    // --- NATUREZA DA OPERAÇÃO ---
    ctx.strokeRect(20, y, W - 40, 28);
    ctx.font = "7px Arial";
    ctx.fillText("NATUREZA DA OPERAÇÃO", 30, y + 10);
    ctx.font = "9px Arial";
    ctx.fillText("VENDA DE MERCADORIA", 30, y + 22);
    y += 34;

    // --- DESTINATÁRIO ---
    ctx.strokeRect(20, y, W - 40, 18);
    ctx.font = "bold 8px Arial";
    ctx.fillText("DESTINATÁRIO / REMETENTE", 30, y + 13);
    y += 18;

    // Dest row 1
    ctx.strokeRect(20, y, 340, 28);
    ctx.strokeRect(360, y, W - 400, 28);
    ctx.font = "7px Arial";
    ctx.fillText("NOME / RAZÃO SOCIAL", 30, y + 10);
    ctx.fillText("CNPJ / CPF", 370, y + 10);
    ctx.font = "9px Arial";
    ctx.fillText("CLIENTE EXEMPLO LTDA", 30, y + 22);
    ctx.fillText("000.000.000-00", 370, y + 22);
    y += 28;

    // Dest row 2
    ctx.strokeRect(20, y, 280, 28);
    ctx.strokeRect(300, y, 130, 28);
    ctx.strokeRect(430, y, W - 470, 28);
    ctx.font = "7px Arial";
    ctx.fillText("ENDEREÇO", 30, y + 10);
    ctx.fillText("BAIRRO / DISTRITO", 310, y + 10);
    ctx.fillText("CEP", 440, y + 10);
    ctx.font = "9px Arial";
    ctx.fillText("Rua Exemplo, 123", 30, y + 22);
    ctx.fillText("Centro", 310, y + 22);
    ctx.fillText("00000-000", 440, y + 22);
    y += 28;

    // Dest row 3
    ctx.strokeRect(20, y, 280, 28);
    ctx.strokeRect(300, y, 60, 28);
    ctx.strokeRect(360, y, 100, 28);
    ctx.strokeRect(460, y, W - 500, 28);
    ctx.font = "7px Arial";
    ctx.fillText("MUNICÍPIO", 30, y + 10);
    ctx.fillText("UF", 310, y + 10);
    ctx.fillText("TELEFONE", 370, y + 10);
    ctx.fillText("IE", 470, y + 10);
    ctx.font = "9px Arial";
    ctx.fillText("São Paulo", 30, y + 22);
    ctx.fillText("SP", 310, y + 22);
    ctx.fillText("(11) 9999-9999", 370, y + 22);
    y += 34;

    // --- CÁLCULO DO IMPOSTO ---
    ctx.strokeRect(20, y, W - 40, 18);
    ctx.font = "bold 8px Arial";
    ctx.fillText("CÁLCULO DO IMPOSTO", 30, y + 13);
    y += 18;

    const taxCols = ["BASE CÁLC. ICMS", "VALOR ICMS", "BASE CÁLC. ICMS ST", "VALOR ICMS ST", "VALOR TOTAL PRODUTOS", "VALOR TOTAL DA NOTA"];
    const colW = (W - 40) / taxCols.length;
    taxCols.forEach((label, i) => {
      ctx.strokeRect(20 + i * colW, y, colW, 28);
      ctx.font = "6px Arial";
      ctx.fillText(label, 25 + i * colW, y + 10);
      ctx.font = "9px Arial";
      ctx.fillText("0,00", 25 + i * colW, y + 22);
    });
    y += 34;

    // --- TRANSPORTADOR ---
    ctx.strokeRect(20, y, W - 40, 18);
    ctx.font = "bold 8px Arial";
    ctx.fillText("TRANSPORTADOR / VOLUMES TRANSPORTADOS", 30, y + 13);
    y += 18;

    ctx.strokeRect(20, y, W - 40, 28);
    ctx.font = "7px Arial";
    ctx.fillText("RAZÃO SOCIAL", 30, y + 10);
    ctx.font = "9px Arial";
    ctx.fillText("TRANSPORTADORA EXEMPLO", 30, y + 22);
    y += 34;

    // --- DADOS DOS PRODUTOS ---
    ctx.strokeRect(20, y, W - 40, 18);
    ctx.font = "bold 8px Arial";
    ctx.fillText("DADOS DOS PRODUTOS / SERVIÇOS", 30, y + 13);
    y += 18;

    // Product header
    const prodHeaders = ["CÓD.", "DESCRIÇÃO", "NCM/SH", "CST", "CFOP", "UN", "QTD", "V.UNIT", "V.TOTAL"];
    const prodWidths = [40, 150, 60, 35, 40, 30, 40, 60, 60];
    let px = 20;
    prodHeaders.forEach((h, i) => {
      ctx.strokeRect(px, y, prodWidths[i], 20);
      ctx.font = "6px Arial";
      ctx.fillText(h, px + 3, y + 13);
      px += prodWidths[i];
    });
    y += 20;

    // Product row (example)
    const prodData = ["001", "PRODUTO EXEMPLO", "0000.00.00", "000", "5102", "UN", "1", "100,00", "100,00"];
    px = 20;
    prodData.forEach((d, i) => {
      ctx.strokeRect(px, y, prodWidths[i], 20);
      ctx.font = "8px Arial";
      ctx.fillText(d, px + 3, y + 13);
      px += prodWidths[i];
    });
    y += 26;

    // --- DADOS ADICIONAIS ---
    ctx.strokeRect(20, y, W - 40, 18);
    ctx.font = "bold 8px Arial";
    ctx.fillText("DADOS ADICIONAIS", 30, y + 13);
    y += 18;

    ctx.strokeRect(20, y, W - 40, 50);
    ctx.font = "8px Arial";
    ctx.fillText("Documento emitido por sistema automatizado.", 30, y + 15);
    y += 56;

    // --- RODAPÉ ---
    ctx.font = "7px Arial";
    ctx.fillStyle = "#666";
    const now = new Date();
    ctx.fillText(`Data e hora da impressão: ${now.toLocaleString("pt-BR")}`, 20, y + 10);
  }, [open, empresa, enderecoCompleto]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pdf = new jsPDF("p", "pt", "a4");
    const imgData = canvas.toDataURL("image/png");
    pdf.addImage(imgData, "PNG", 0, 0, 595, 842);
    pdf.save(`DANFE_${empresa.razao_social || "empresa"}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[660px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pré-visualização da DANFE</DialogTitle>
        </DialogHeader>
        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            className="border border-border shadow-sm"
            style={{ width: 595, height: 842, maxWidth: "100%" }}
          />
        </div>
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
