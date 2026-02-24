import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Download, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const CSV_HEADERS = [
  "cliente_nome", "cliente_email", "cliente_cpf", "cliente_telefone",
  "cliente_cep", "cliente_endereco", "cliente_numero", "cliente_bairro",
  "cliente_cidade", "cliente_estado", "cliente_complemento",
  "produto", "quantidade", "valor",
  "cfop", "ncm_sh", "cst", "unidade", "codigo_rastreio",
];

const CSV_EXAMPLE_ROWS = [
  "João Silva,joao@email.com,123.456.789-00,(11)99999-0000,01001-000,Rua Exemplo,100,Centro,São Paulo,SP,Apto 1,Camiseta P,2,49.90,5102,61091000,000,UN,BR123456789",
  "Maria Souza,maria@email.com,987.654.321-00,(21)98888-0000,20040-020,Av Teste,200,Botafogo,Rio de Janeiro,RJ,,Tênis 42,1,199.90,5102,64039990,000,PAR,",
];

function parseCsvLine(line: string): string[] {
  const sep = line.includes(";") ? ";" : ",";
  return line.split(sep).map((v) => v.trim());
}

interface Props {
  lojaId: string;
}

export function ImportarPlanilha({ lojaId }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Record<string, string>[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const queryClient = useQueryClient();

  const handleDownloadModelo = () => {
    const content = [CSV_HEADERS.join(","), ...CSV_EXAMPLE_ROWS].join("\n");
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo_envios.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) {
        toast.error("Arquivo vazio ou sem dados.");
        return;
      }

      const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
      const rows: Record<string, string>[] = [];
      const errs: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const vals = parseCsvLine(lines[i]);
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
          row[h] = vals[idx] || "";
        });

        const missing: string[] = [];
        if (!row.cliente_nome) missing.push("cliente_nome");
        if (!row.cliente_email) missing.push("cliente_email");
        if (!row.produto) missing.push("produto");
        if (!row.valor) missing.push("valor");

        if (missing.length > 0) {
          errs.push(`Linha ${i + 1}: faltando ${missing.join(", ")}`);
        } else {
          rows.push(row);
        }
      }

      setParsed(rows);
      setErrors(errs);
      setDialogOpen(true);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const records = parsed.map((row) => ({
        loja_id: lojaId,
        status: "pendente" as const,
        cliente_nome: row.cliente_nome,
        cliente_email: row.cliente_email,
        cliente_cpf: row.cliente_cpf || null,
        cliente_telefone: row.cliente_telefone || null,
        cliente_cep: row.cliente_cep || null,
        cliente_endereco: row.cliente_endereco || null,
        cliente_numero: row.cliente_numero || null,
        cliente_bairro: row.cliente_bairro || null,
        cliente_cidade: row.cliente_cidade || null,
        cliente_estado: row.cliente_estado || null,
        cliente_complemento: row.cliente_complemento || null,
        produto: row.produto,
        quantidade: parseInt(row.quantidade) || 1,
        valor: parseFloat(row.valor) || 0,
        cfop: row.cfop || null,
        ncm_sh: row.ncm_sh || null,
        cst: row.cst || null,
        unidade: row.unidade || "UN",
        codigo_rastreio: row.codigo_rastreio || null,
      }));

      const { error } = await supabase.from("envios").insert(records as any);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["envios"] });
      toast.success(`${records.length} envio(s) importados com sucesso!`);
      if (errors.length > 0) {
        toast.warning(`${errors.length} linha(s) ignoradas por erros.`);
      }
      setDialogOpen(false);
      setParsed([]);
      setErrors([]);
    } catch (err: any) {
      toast.error(err.message || "Erro ao importar.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleDownloadModelo}>
        <Download className="h-3.5 w-3.5 mr-1" /> Baixar Modelo
      </Button>
      <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
        <Upload className="h-3.5 w-3.5 mr-1" /> Importar CSV
      </Button>
      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Importação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p><strong>{parsed.length}</strong> registro(s) válidos prontos para importar.</p>
            {errors.length > 0 && (
              <div className="bg-destructive/10 text-destructive rounded-md p-3 max-h-32 overflow-auto text-xs">
                <p className="font-semibold mb-1">{errors.length} erro(s):</p>
                {errors.slice(0, 10).map((e, i) => <p key={i}>{e}</p>)}
                {errors.length > 10 && <p>...e mais {errors.length - 10}</p>}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleImport} disabled={parsed.length === 0 || importing}>
              {importing ? "Importando..." : `Importar ${parsed.length} registro(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
