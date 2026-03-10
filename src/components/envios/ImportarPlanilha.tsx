import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Download, Upload, ShoppingBag, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

/* ─── Our internal CSV template headers ─── */
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

/* ─── Robust CSV parser (handles quoted fields with newlines, commas, etc.) ─── */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          // escaped quote
          field += '"';
          i += 2;
        } else {
          // end of quoted field
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        row.push(field.trim());
        field = "";
        i++;
      } else if (ch === '\r') {
        // skip carriage return
        i++;
      } else if (ch === '\n') {
        row.push(field.trim());
        field = "";
        rows.push(row);
        row = [];
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  // last field / row
  if (field || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }

  return rows;
}

/* ─── Shopify column detection & mapping ─── */
const SHOPIFY_SIGNATURE_HEADERS = ["name", "lineitem name", "shipping name", "shipping city"];

function isShopifyCSV(headers: string[]): boolean {
  const lower = headers.map((h) => h.toLowerCase().trim());
  return SHOPIFY_SIGNATURE_HEADERS.every((sig) => lower.includes(sig));
}

function colIndex(headers: string[], name: string): number {
  return headers.findIndex((h) => h.toLowerCase().trim() === name.toLowerCase());
}

function getVal(row: string[], headers: string[], colName: string): string {
  const idx = colIndex(headers, colName);
  return idx >= 0 && idx < row.length ? (row[idx] || "").trim() : "";
}

interface ParsedShipment {
  cliente_nome: string;
  cliente_email: string;
  cliente_cpf: string;
  cliente_telefone: string;
  cliente_cep: string;
  cliente_endereco: string;
  cliente_numero: string;
  cliente_bairro: string;
  cliente_cidade: string;
  cliente_estado: string;
  cliente_complemento: string;
  produto: string;
  quantidade: number;
  valor: number;
  order_name: string;
  pais: string;
  [key: string]: any;
}

function parseShopifyRows(headers: string[], dataRows: string[][]): { rows: ParsedShipment[]; errors: string[] } {
  const errors: string[] = [];

  // Group rows by order Name (e.g. "#1197") — Shopify repeats order rows for each line item
  const orderMap = new Map<string, { masterRow: string[]; items: { name: string; qty: number; price: number }[] }>();
  const orderKeys: string[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const orderName = getVal(row, headers, "Name");
    if (!orderName) {
      errors.push(`Linha ${i + 2}: sem número de pedido (Name), ignorada.`);
      continue;
    }

    const itemName = getVal(row, headers, "Lineitem name");
    const itemQty = parseInt(getVal(row, headers, "Lineitem quantity")) || 1;
    const itemPrice = parseFloat(getVal(row, headers, "Lineitem price")) || 0;

    if (!orderMap.has(orderName)) {
      orderMap.set(orderName, { masterRow: row, items: [] });
      orderKeys.push(orderName);
    }

    const entry = orderMap.get(orderName)!;

    // If this row has shipping info (not a continuation line item), use it as master
    if (getVal(row, headers, "Shipping Name")) {
      entry.masterRow = row;
    }

    if (itemName) {
      entry.items.push({ name: itemName, qty: itemQty, price: itemPrice });
    }
  }

  const result: ParsedShipment[] = [];

  for (const orderName of orderKeys) {
    const { masterRow, items } = orderMap.get(orderName)!;

    // Extract customer info from shipping fields (preferred) with billing as fallback
    const shippingName = getVal(masterRow, headers, "Shipping Name") || getVal(masterRow, headers, "Billing Name");
    const email = getVal(masterRow, headers, "Email");
    const shippingPhone = getVal(masterRow, headers, "Shipping Phone") || getVal(masterRow, headers, "Phone") || getVal(masterRow, headers, "Billing Phone");
    const shippingAddr1 = getVal(masterRow, headers, "Shipping Address1") || getVal(masterRow, headers, "Billing Address1");
    const shippingAddr2 = getVal(masterRow, headers, "Shipping Address2") || getVal(masterRow, headers, "Billing Address2");
    const shippingCity = getVal(masterRow, headers, "Shipping City") || getVal(masterRow, headers, "Billing City");
    const shippingProvince = getVal(masterRow, headers, "Shipping Province Name") || getVal(masterRow, headers, "Shipping Province") || getVal(masterRow, headers, "Billing Province Name") || getVal(masterRow, headers, "Billing Province");
    const shippingZip = getVal(masterRow, headers, "Shipping Zip") || getVal(masterRow, headers, "Billing Zip");
    const shippingCountry = getVal(masterRow, headers, "Shipping Country") || getVal(masterRow, headers, "Billing Country");
    const total = parseFloat(getVal(masterRow, headers, "Total")) || 0;
    const notes = getVal(masterRow, headers, "Notes");
    const noteAttrs = getVal(masterRow, headers, "Note Attributes");

    // Try to extract WhatsApp/phone from Note Attributes (common in COD stores)
    let extractedPhone = shippingPhone;
    if (!extractedPhone && noteAttrs) {
      const whatsMatch = noteAttrs.match(/WhatsApp:\s*(\+?\d[\d\s-]+)/i);
      if (whatsMatch) extractedPhone = whatsMatch[1].trim();
    }

    // Extract document/CPF if present in notes
    let cpf = "";
    if (noteAttrs) {
      const docMatch = noteAttrs.match(/(?:documento|cedula|cpf|cc|nit)[\s:]+([^\n]+)/i);
      if (docMatch) cpf = docMatch[1].trim();
    }

    // Combine line items into product description
    const productNames = items.map((it) => {
      return it.qty > 1 ? `${it.qty}x ${it.name}` : it.name;
    });
    const totalQty = items.reduce((sum, it) => sum + it.qty, 0) || 1;

    // Validate minimal required fields
    if (!shippingName) {
      errors.push(`Pedido ${orderName}: sem nome do cliente, ignorado.`);
      continue;
    }

    if (items.length === 0) {
      errors.push(`Pedido ${orderName}: sem produtos, ignorado.`);
      continue;
    }

    result.push({
      order_name: orderName,
      cliente_nome: shippingName,
      cliente_email: email || "",
      cliente_cpf: cpf,
      cliente_telefone: extractedPhone,
      cliente_cep: shippingZip !== "-" ? shippingZip : "",
      cliente_endereco: shippingAddr1,
      cliente_numero: "",
      cliente_bairro: "",
      cliente_cidade: shippingCity,
      cliente_estado: shippingProvince,
      cliente_complemento: shippingAddr2,
      produto: productNames.join(" + "),
      quantidade: totalQty,
      valor: total || items.reduce((s, it) => s + it.price * it.qty, 0),
      pais: shippingCountry,
    });
  }

  return { rows: result, errors };
}

/* ─── Simple internal-format CSV line parser ─── */
function parseCsvLine(line: string): string[] {
  const sep = line.includes(";") ? ";" : ",";
  return line.split(sep).map((v) => v.trim());
}

interface Props {
  lojaId: string;
}

export function ImportarPlanilha({ lojaId }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Record<string, any>[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [isShopify, setIsShopify] = useState(false);
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

      // Use robust CSV parser
      const allRows = parseCSV(text);
      if (allRows.length < 2) {
        toast.error("Arquivo vazio ou sem dados.");
        return;
      }

      const headers = allRows[0];
      const dataRows = allRows.slice(1).filter((r) => r.some((cell) => cell.trim()));

      if (isShopifyCSV(headers)) {
        // ── Shopify CSV detected ──
        setIsShopify(true);
        const { rows, errors: errs } = parseShopifyRows(headers, dataRows);
        setParsed(rows);
        setErrors(errs);
        setDialogOpen(true);
        if (rows.length > 0) {
          toast.success(`🛒 CSV Shopify detectado! ${rows.length} pedido(s) encontrados.`);
        }
      } else {
        // ── Internal format ──
        setIsShopify(false);
        const lowerHeaders = headers.map((h) => h.toLowerCase().trim());
        const rows: Record<string, string>[] = [];
        const errs: string[] = [];

        for (let i = 0; i < dataRows.length; i++) {
          const vals = dataRows[i];
          const row: Record<string, string> = {};
          lowerHeaders.forEach((h, idx) => {
            row[h] = vals[idx] || "";
          });

          const missing: string[] = [];
          if (!row.cliente_nome) missing.push("cliente_nome");
          if (!row.cliente_email) missing.push("cliente_email");
          if (!row.produto) missing.push("produto");
          if (!row.valor) missing.push("valor");

          if (missing.length > 0) {
            errs.push(`Linha ${i + 2}: faltando ${missing.join(", ")}`);
          } else {
            rows.push(row);
          }
        }

        setParsed(rows);
        setErrors(errs);
        setDialogOpen(true);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const { data: lojaData } = await supabase
        .from("lojas")
        .select("logistica_provider")
        .eq("id", lojaId)
        .single();

      const { data: configData } = await supabase
        .from("postagem_config")
        .select("template_ativo_id")
        .eq("loja_id", lojaId)
        .maybeSingle();

      const provider = lojaData?.logistica_provider || "jl";
      const trackingSuffix = provider === "jadlog" ? "JD" : "JL";
      const defaultTransportadora = provider === "jadlog" ? "JADLOG Logística" : "JL RASTREIOS";

      const records = parsed.map((row) => {
        let codigo_rastreio = row.codigo_rastreio || null;
        let transportadora = row.transportadora || null;

        if (!codigo_rastreio) {
          const randomNumbers = Math.floor(Math.random() * 900000000) + 100000000;
          codigo_rastreio = `BR${randomNumbers}${trackingSuffix}`;
          transportadora = defaultTransportadora;
        }

        return {
          loja_id: lojaId,
          status: "pendente" as const,
          cliente_nome: row.cliente_nome,
          cliente_email: row.cliente_email || null,
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
          quantidade: typeof row.quantidade === "number" ? row.quantidade : parseInt(row.quantidade) || 1,
          valor: typeof row.valor === "number" ? row.valor : parseFloat(row.valor) || 0,
          cfop: row.cfop || null,
          ncm_sh: row.ncm_sh || null,
          cst: row.cst || null,
          unidade: row.unidade || "UN",
          codigo_rastreio,
          transportadora,
          postagem_template_id: configData?.template_ativo_id || null
        };
      });

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
      setIsShopify(false);
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
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isShopify ? (
                <>
                  <ShoppingBag className="h-5 w-5 text-green-500" />
                  Importar Pedidos Shopify
                </>
              ) : (
                <>
                  <FileSpreadsheet className="h-5 w-5 text-blue-500" />
                  Confirmar Importação
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            {isShopify && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-xs text-green-700 dark:text-green-300">
                <p className="font-semibold mb-1">🛒 CSV Shopify detectado automaticamente</p>
                <p>Os pedidos foram mapeados a partir do formato de exportação da Shopify. Nomes, endereços, telefones, produtos e valores foram extraídos.</p>
              </div>
            )}

            <p><strong>{parsed.length}</strong> pedido(s) válidos prontos para importar.</p>

            {/* Preview of first items */}
            {parsed.length > 0 && (
              <div className="max-h-48 overflow-auto border rounded-md">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      {isShopify && <th className="p-1.5 text-left font-medium">#</th>}
                      <th className="p-1.5 text-left font-medium">Cliente</th>
                      <th className="p-1.5 text-left font-medium">Cidade</th>
                      <th className="p-1.5 text-left font-medium">Produto</th>
                      <th className="p-1.5 text-right font-medium">Valor</th>
                      <th className="p-1.5 text-left font-medium">Telefone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.slice(0, 20).map((row, i) => (
                      <tr key={i} className="border-t border-border/50 hover:bg-muted/30">
                        {isShopify && <td className="p-1.5 text-muted-foreground">{row.order_name}</td>}
                        <td className="p-1.5 font-medium max-w-[120px] truncate">{row.cliente_nome}</td>
                        <td className="p-1.5 text-muted-foreground max-w-[80px] truncate">
                          {row.cliente_cidade}{row.cliente_estado ? `, ${row.cliente_estado}` : ""}
                        </td>
                        <td className="p-1.5 max-w-[150px] truncate" title={row.produto}>{row.produto}</td>
                        <td className="p-1.5 text-right tabular-nums">
                          {(typeof row.valor === "number" ? row.valor : parseFloat(row.valor) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </td>
                        <td className="p-1.5 text-muted-foreground text-[10px]">{row.cliente_telefone || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsed.length > 20 && (
                  <p className="text-xs text-center text-muted-foreground py-1">...e mais {parsed.length - 20} pedido(s)</p>
                )}
              </div>
            )}

            {errors.length > 0 && (
              <div className="bg-destructive/10 text-destructive rounded-md p-3 max-h-32 overflow-auto text-xs">
                <p className="font-semibold mb-1">{errors.length} aviso(s):</p>
                {errors.slice(0, 10).map((e, i) => <p key={i}>{e}</p>)}
                {errors.length > 10 && <p>...e mais {errors.length - 10}</p>}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleImport} disabled={parsed.length === 0 || importing}>
              {importing ? "Importando..." : `Importar ${parsed.length} pedido(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
