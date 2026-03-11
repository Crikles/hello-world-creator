import { useRef, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Upload, ShoppingBag, FileSpreadsheet, ArrowRight, Columns } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";

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

/* ─── System fields for column mapping ─── */
const SYSTEM_FIELDS = [
  { key: "cliente_nome", label: "Nome do Cliente", required: true },
  { key: "cliente_email", label: "Email", required: true },
  { key: "cliente_cpf", label: "CPF", required: false },
  { key: "cliente_telefone", label: "Telefone", required: false },
  { key: "cliente_cep", label: "CEP", required: false },
  { key: "cliente_endereco", label: "Endereço", required: false },
  { key: "cliente_numero", label: "Número", required: false },
  { key: "cliente_bairro", label: "Bairro", required: false },
  { key: "cliente_cidade", label: "Cidade", required: false },
  { key: "cliente_estado", label: "Estado", required: false },
  { key: "cliente_complemento", label: "Complemento", required: false },
  { key: "produto", label: "Produto", required: true },
  { key: "quantidade", label: "Quantidade", required: false },
  { key: "valor", label: "Valor", required: true },
  { key: "cfop", label: "CFOP", required: false },
  { key: "ncm_sh", label: "NCM/SH", required: false },
  { key: "cst", label: "CST", required: false },
  { key: "unidade", label: "Unidade", required: false },
  { key: "codigo_rastreio", label: "Código Rastreio", required: false },
];

/* ─── Similarity matching for auto-mapping ─── */
const ALIAS_MAP: Record<string, string[]> = {
  cliente_nome: ["nome", "client_nome", "cliente_nome", "name", "customer_name", "nome_cliente", "nome do cliente", "cliente"],
  cliente_email: ["email", "e-mail", "client_email", "cliente_email", "customer_email", "email_cliente"],
  cliente_cpf: ["cpf", "documento", "doc", "client_cpf", "cliente_cpf", "customer_document"],
  cliente_telefone: ["telefone", "phone", "fone", "celular", "tel", "client_telefone", "cliente_telefone", "whatsapp"],
  cliente_cep: ["cep", "zipcode", "zip", "zip_code", "codigo_postal", "client_cep", "cliente_cep"],
  cliente_endereco: ["endereco", "address", "rua", "logradouro", "client_endereco", "cliente_endereco", "street"],
  cliente_numero: ["numero", "number", "num", "nro", "client_numero", "cliente_numero"],
  cliente_bairro: ["bairro", "neighborhood", "client_bairro", "cliente_bairro"],
  cliente_cidade: ["cidade", "city", "client_cidade", "cliente_cidade"],
  cliente_estado: ["estado", "state", "uf", "client_estado", "cliente_estado"],
  cliente_complemento: ["complemento", "complement", "comp", "client_complemento", "cliente_complemento"],
  produto: ["produto", "product", "item", "descricao", "nome_produto"],
  quantidade: ["quantidade", "qty", "quantity", "qtd", "qtde"],
  valor: ["valor", "value", "price", "preco", "total", "amount"],
  cfop: ["cfop"],
  ncm_sh: ["ncm_sh", "ncm", "ncmsh"],
  cst: ["cst"],
  unidade: ["unidade", "unit", "un"],
  codigo_rastreio: ["codigo_rastreio", "rastreio", "tracking", "tracking_code"],
};

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
}

function autoMapColumns(fileHeaders: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedHeaders = new Set<string>();

  for (const field of SYSTEM_FIELDS) {
    const aliases = ALIAS_MAP[field.key] || [field.key];
    const normalizedAliases = aliases.map(normalize);

    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const fh of fileHeaders) {
      if (usedHeaders.has(fh)) continue;
      const normFh = normalize(fh);

      // Exact match
      if (normalizedAliases.includes(normFh)) {
        bestMatch = fh;
        bestScore = 100;
        break;
      }

      // Partial: file header contains alias or alias contains file header
      for (const alias of normalizedAliases) {
        if (normFh.includes(alias) || alias.includes(normFh)) {
          const score = Math.min(alias.length, normFh.length) / Math.max(alias.length, normFh.length) * 80;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = fh;
          }
        }
      }
    }

    if (bestMatch && bestScore >= 40) {
      mapping[field.key] = bestMatch;
      usedHeaders.add(bestMatch);
    }
  }

  return mapping;
}

/* ─── Robust CSV parser ─── */
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
          field += '"';
          i += 2;
        } else {
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
      } else if (ch === ',' || ch === ';') {
        row.push(field.trim());
        field = "";
        i++;
      } else if (ch === '\r') {
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

  if (field || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }

  return rows;
}

/* ─── Shopify detection ─── */
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
  const orderMap = new Map<string, { masterRow: string[]; items: { name: string; qty: number; price: number }[] }>();
  const orderKeys: string[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const orderName = getVal(row, headers, "Name");
    if (!orderName) { errors.push(`Linha ${i + 2}: sem número de pedido (Name), ignorada.`); continue; }

    const itemName = getVal(row, headers, "Lineitem name");
    const itemQty = parseInt(getVal(row, headers, "Lineitem quantity")) || 1;
    const itemPrice = parseFloat(getVal(row, headers, "Lineitem price")) || 0;

    if (!orderMap.has(orderName)) {
      orderMap.set(orderName, { masterRow: row, items: [] });
      orderKeys.push(orderName);
    }

    const entry = orderMap.get(orderName)!;
    if (getVal(row, headers, "Shipping Name")) entry.masterRow = row;
    if (itemName) entry.items.push({ name: itemName, qty: itemQty, price: itemPrice });
  }

  const result: ParsedShipment[] = [];

  for (const orderName of orderKeys) {
    const { masterRow, items } = orderMap.get(orderName)!;
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
    const noteAttrs = getVal(masterRow, headers, "Note Attributes");

    let extractedPhone = shippingPhone;
    if (!extractedPhone && noteAttrs) {
      const whatsMatch = noteAttrs.match(/WhatsApp:\s*(\+?\d[\d\s-]+)/i);
      if (whatsMatch) extractedPhone = whatsMatch[1].trim();
    }

    let cpf = "";
    if (noteAttrs) {
      const docMatch = noteAttrs.match(/(?:documento|cedula|cpf|cc|nit)[\s:]+([^\n]+)/i);
      if (docMatch) cpf = docMatch[1].trim();
    }

    const productNames = items.map((it) => it.qty > 1 ? `${it.qty}x ${it.name}` : it.name);
    const totalQty = items.reduce((sum, it) => sum + it.qty, 0) || 1;

    if (!shippingName) { errors.push(`Pedido ${orderName}: sem nome do cliente, ignorado.`); continue; }
    if (items.length === 0) { errors.push(`Pedido ${orderName}: sem produtos, ignorado.`); continue; }

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

/* ─── Check if headers match our internal format exactly ─── */
function isInternalFormat(headers: string[]): boolean {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const requiredInternal = ["cliente_nome", "cliente_email", "produto", "valor"];
  return requiredInternal.every((r) => lower.includes(r));
}

/* ─── Parse file (CSV or XLSX) into rows ─── */
function parseFileToRows(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = new Uint8Array(ev.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
          // Convert all cells to strings
          const stringRows = rows.map((row) => row.map((cell: any) => String(cell ?? "").trim()));
          resolve(stringRows);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        resolve(parseCSV(text));
      };
      reader.onerror = reject;
      reader.readAsText(file);
    }
  });
}

interface Props {
  lojaId: string;
}

type Step = "idle" | "mapping" | "preview";

export function ImportarPlanilha({ lojaId }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Record<string, any>[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [isShopify, setIsShopify] = useState(false);
  const queryClient = useQueryClient();

  // Mapping state
  const [step, setStep] = useState<Step>("idle");
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawDataRows, setRawDataRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    try {
      const allRows = await parseFileToRows(file);
      if (allRows.length < 2) {
        toast.error("Arquivo vazio ou sem dados.");
        return;
      }

      const headers = allRows[0];
      const dataRows = allRows.slice(1).filter((r) => r.some((cell) => cell.trim()));

      if (isShopifyCSV(headers)) {
        // Shopify CSV detected
        setIsShopify(true);
        setStep("preview");
        const { rows, errors: errs } = parseShopifyRows(headers, dataRows);
        setParsed(rows);
        setErrors(errs);
        setDialogOpen(true);
        if (rows.length > 0) toast.success(`🛒 CSV Shopify detectado! ${rows.length} pedido(s) encontrados.`);
      } else if (isInternalFormat(headers)) {
        // Internal format — direct parse
        setIsShopify(false);
        setStep("preview");
        const lowerHeaders = headers.map((h) => h.toLowerCase().trim());
        const rows: Record<string, string>[] = [];
        const errs: string[] = [];

        for (let i = 0; i < dataRows.length; i++) {
          const vals = dataRows[i];
          const row: Record<string, string> = {};
          lowerHeaders.forEach((h, idx) => { row[h] = vals[idx] || ""; });

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
      } else {
        // Unknown format — open mapping modal
        setIsShopify(false);
        setStep("mapping");
        setRawHeaders(headers);
        setRawDataRows(dataRows);
        const autoMapped = autoMapColumns(headers);
        setColumnMapping(autoMapped);
        setParsed([]);
        setErrors([]);
        setDialogOpen(true);
        toast.info("Formato não reconhecido. Mapeie as colunas do arquivo.");
      }
    } catch (err: any) {
      toast.error("Erro ao ler o arquivo: " + (err.message || ""));
    }
  };

  const mappedFieldCount = useMemo(() => {
    return Object.keys(columnMapping).length;
  }, [columnMapping]);

  const requiredFieldsMapped = useMemo(() => {
    const required = SYSTEM_FIELDS.filter((f) => f.required).map((f) => f.key);
    return required.every((r) => columnMapping[r]);
  }, [columnMapping]);

  const handleConfirmMapping = () => {
    const rows: Record<string, any>[] = [];
    const errs: string[] = [];

    for (let i = 0; i < rawDataRows.length; i++) {
      const dataRow = rawDataRows[i];
      const row: Record<string, any> = {};

      for (const field of SYSTEM_FIELDS) {
        const mappedHeader = columnMapping[field.key];
        if (mappedHeader) {
          const colIdx = rawHeaders.indexOf(mappedHeader);
          row[field.key] = colIdx >= 0 ? (dataRow[colIdx] || "").trim() : "";
        } else {
          row[field.key] = "";
        }
      }

      // Parse numeric fields
      if (row.quantidade) row.quantidade = parseInt(row.quantidade) || 1;
      else row.quantidade = 1;
      if (row.valor) {
        // Handle "R$ 49,90" or "49.90" or "49,90"
        const cleaned = String(row.valor).replace(/[R$\s]/g, "").replace(",", ".");
        row.valor = parseFloat(cleaned) || 0;
      } else {
        row.valor = 0;
      }

      const missing: string[] = [];
      if (!row.cliente_nome) missing.push("Nome");
      if (!row.cliente_email) missing.push("Email");
      if (!row.produto) missing.push("Produto");
      if (!row.valor) missing.push("Valor");

      if (missing.length > 0) {
        errs.push(`Linha ${i + 2}: faltando ${missing.join(", ")}`);
      } else {
        rows.push(row);
      }
    }

    setParsed(rows);
    setErrors(errs);
    setStep("preview");

    if (rows.length > 0) {
      toast.success(`${rows.length} pedido(s) mapeados com sucesso!`);
    } else {
      toast.error("Nenhum pedido válido após o mapeamento.");
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const { data: configData } = await supabase
        .from("postagem_config")
        .select("template_ativo_id")
        .eq("loja_id", lojaId)
        .maybeSingle();

      const records = parsed.map((row) => ({
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
        codigo_rastreio: row.codigo_rastreio || null,
        transportadora: row.transportadora || null,
        postagem_template_id: configData?.template_ativo_id || null,
      }));

      const { error } = await supabase.from("envios").insert(records as any);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["envios"] });
      toast.success(`${records.length} envio(s) importados com sucesso!`);
      if (errors.length > 0) toast.warning(`${errors.length} linha(s) ignoradas por erros.`);
      handleClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao importar.");
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setDialogOpen(false);
    setParsed([]);
    setErrors([]);
    setIsShopify(false);
    setStep("idle");
    setRawHeaders([]);
    setRawDataRows([]);
    setColumnMapping({});
  };

  const updateMapping = (fieldKey: string, headerValue: string) => {
    setColumnMapping((prev) => {
      const next = { ...prev };
      if (headerValue === "__none__") {
        delete next[fieldKey];
      } else {
        next[fieldKey] = headerValue;
      }
      return next;
    });
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleDownloadModelo}>
        <Download className="h-3.5 w-3.5 mr-1" /> Baixar Modelo
      </Button>
      <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
        <Upload className="h-3.5 w-3.5 mr-1" /> Importar Planilha
      </Button>
      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileSelect} />

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {step === "mapping" ? (
                <>
                  <Columns className="h-5 w-5 text-primary" />
                  Mapear Colunas
                </>
              ) : isShopify ? (
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

          {/* ─── STEP: MAPPING ─── */}
          {step === "mapping" && (
            <div className="space-y-3 text-sm flex-1 overflow-auto">
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-xs">
                <p className="font-semibold mb-1">📋 Mapeamento de Colunas</p>
                <p className="text-muted-foreground">
                  Associe cada campo do sistema à coluna correspondente do seu arquivo.
                  Campos com <span className="text-destructive font-medium">*</span> são obrigatórios.
                  {rawDataRows.length} linha(s) detectadas.
                </p>
              </div>

              {/* Sample data preview */}
              {rawDataRows.length > 0 && (
                <div className="max-h-24 overflow-auto border rounded-md">
                  <table className="w-full text-[10px]">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        {rawHeaders.map((h, i) => (
                          <th key={i} className="p-1 text-left font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rawDataRows.slice(0, 3).map((row, i) => (
                        <tr key={i} className="border-t border-border/50">
                          {rawHeaders.map((_, ci) => (
                            <td key={ci} className="p-1 whitespace-nowrap max-w-[100px] truncate text-muted-foreground">
                              {row[ci] || ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Mapping fields */}
              <div className="grid gap-2">
                {SYSTEM_FIELDS.map((field) => {
                  const currentValue = columnMapping[field.key] || "__none__";
                  return (
                    <div key={field.key} className="flex items-center gap-2">
                      <div className="w-[45%] text-xs flex items-center gap-1.5">
                        <span className="font-medium">{field.label}</span>
                        {field.required && <span className="text-destructive text-[10px]">*</span>}
                      </div>
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <div className="w-[50%]">
                        <Select value={currentValue} onValueChange={(v) => updateMapping(field.key, v)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Não mapeado" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Não mapeado —</SelectItem>
                            {rawHeaders.map((h) => (
                              <SelectItem key={h} value={h}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground">
                {mappedFieldCount} campo(s) mapeados de {SYSTEM_FIELDS.length}
              </p>
            </div>
          )}

          {/* ─── STEP: PREVIEW ─── */}
          {step === "preview" && (
            <div className="space-y-3 text-sm flex-1 overflow-auto">
              {isShopify && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-xs text-green-700 dark:text-green-300">
                  <p className="font-semibold mb-1">🛒 CSV Shopify detectado automaticamente</p>
                  <p>Os pedidos foram mapeados a partir do formato de exportação da Shopify.</p>
                </div>
              )}

              <p><strong>{parsed.length}</strong> pedido(s) válidos prontos para importar.</p>

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
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>Cancelar</Button>
            {step === "mapping" && (
              <Button onClick={handleConfirmMapping} disabled={!requiredFieldsMapped}>
                Confirmar Mapeamento
              </Button>
            )}
            {step === "preview" && (
              <Button onClick={handleImport} disabled={parsed.length === 0 || importing}>
                {importing ? "Importando..." : `Importar ${parsed.length} pedido(s)`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
