import { useState } from "react";
import { useLoja } from "@/contexts/LojaContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check, BookOpen, Terminal, Code2, FileCode2, ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from "react-router-dom";

const ENDPOINT_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-external`;

const payloadExample = `{
  "customer": {
    "name": "João Silva",
    "email": "joao@email.com",
    "document": "12345678900",
    "phone": "11999999999"
  },
  "address": {
    "street": "Rua Example",
    "number": "123",
    "neighborhood": "Centro",
    "city": "São Paulo",
    "state": "SP",
    "zipcode": "01001000",
    "complement": "Apto 1"
  },
  "items": [
    { "name": "Produto X", "quantity": 2, "price": 49.90 }
  ],
  "total": 99.80
}`;

const responseExample = `{
  "success": true,
  "pedido_id": "uuid-do-pedido",
  "envio_id": "uuid-do-envio",
  "codigo_rastreio": "BR1A2B3C4D5EJL"
}`;

const fields = [
  { path: "customer.name", type: "string", required: true, desc: "Nome completo do cliente" },
  { path: "customer.email", type: "string", required: true, desc: "E-mail do cliente" },
  { path: "customer.document", type: "string", required: false, desc: "CPF ou CNPJ do cliente" },
  { path: "customer.phone", type: "string", required: false, desc: "Telefone com DDD" },
  { path: "address.street", type: "string", required: false, desc: "Rua/Logradouro" },
  { path: "address.number", type: "string", required: false, desc: "Número" },
  { path: "address.neighborhood", type: "string", required: false, desc: "Bairro" },
  { path: "address.city", type: "string", required: false, desc: "Cidade" },
  { path: "address.state", type: "string", required: false, desc: "Estado (UF)" },
  { path: "address.zipcode", type: "string", required: false, desc: "CEP (apenas números)" },
  { path: "address.complement", type: "string", required: false, desc: "Complemento" },
  { path: "items[].name", type: "string", required: true, desc: "Nome do produto" },
  { path: "items[].quantity", type: "number", required: false, desc: "Quantidade (padrão: 1)" },
  { path: "items[].price", type: "number", required: false, desc: "Preço unitário em R$" },
  { path: "total", type: "number", required: false, desc: "Valor total. Se omitido, é calculado automaticamente" },
];

export default function ApiDocs() {
  const { loja } = useLoja();
  const navigate = useNavigate();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const token = loja?.webhook_token || "SEU_TOKEN";
  const fullUrl = `${ENDPOINT_BASE}?token=${token}`;

  const curlExample = `curl -X POST "${fullUrl}" \\
  -H "Content-Type: application/json" \\
  -d '${payloadExample}'`;

  const jsExample = `const response = await fetch("${fullUrl}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(${payloadExample})
});

const data = await response.json();
console.log(data.codigo_rastreio);`;

  const pythonExample = `import requests

response = requests.post(
    "${fullUrl}",
    json=${payloadExample}
)

data = response.json()
print(data["codigo_rastreio"])`;

  const copyText = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast({ title: "Copiado!" });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const CopyBtn = ({ text, id }: { text: string; id: string }) => (
    <Button
      variant="ghost"
      size="icon"
      className="absolute top-2 right-2 h-7 w-7 glass border-primary/20"
      onClick={() => copyText(text, id)}
    >
      {copiedKey === id ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
    </Button>
  );

  return (
    <>
      {/* Header */}
      <div className="glass glow-border rounded-xl p-5 mb-6 animate-stagger-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => navigate(`/loja/${loja?.id}/integracoes`)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="p-2.5 rounded-xl bg-primary/10">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Documentação da API</h1>
              <p className="text-sm text-muted-foreground">
                Envie pedidos diretamente para o sistema via HTTP POST.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="border-primary/30 text-primary">v1</Badge>
        </div>
      </div>

      {/* Endpoint + Token */}
      <div className="grid gap-4 md:grid-cols-2 mb-6 animate-stagger-in" style={{ animationDelay: "0.05s" }}>
        <div className="glass glow-border rounded-xl p-5">
          <label className="text-xs font-semibold text-muted-foreground mb-2 block">ENDPOINT</label>
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shrink-0">POST</Badge>
            <code className="text-xs text-foreground truncate flex-1">{ENDPOINT_BASE}</code>
          </div>
        </div>
        <div className="glass glow-border rounded-xl p-5">
          <label className="text-xs font-semibold text-muted-foreground mb-2 block">SEU TOKEN</label>
          <div className="flex items-center gap-2">
            <code className="text-xs text-foreground flex-1 truncate glass border-primary/10 px-3 py-2 rounded-lg">{token}</code>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 h-8 w-8 glass border-primary/20"
              onClick={() => copyText(token, "token")}
            >
              {copiedKey === "token" ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Code Examples */}
      <div className="glass glow-border rounded-xl p-5 mb-6 animate-stagger-in" style={{ animationDelay: "0.1s" }}>
        <h2 className="text-sm font-bold text-foreground mb-4">Exemplos de Integração</h2>
        <Tabs defaultValue="curl" className="w-full">
          <TabsList className="glass mb-4">
            <TabsTrigger value="curl" className="gap-1.5 text-xs"><Terminal className="h-3.5 w-3.5" />cURL</TabsTrigger>
            <TabsTrigger value="js" className="gap-1.5 text-xs"><Code2 className="h-3.5 w-3.5" />JavaScript</TabsTrigger>
            <TabsTrigger value="python" className="gap-1.5 text-xs"><FileCode2 className="h-3.5 w-3.5" />Python</TabsTrigger>
          </TabsList>
          <TabsContent value="curl">
            <div className="relative">
              <CopyBtn text={curlExample} id="curl" />
              <pre className="glass rounded-lg p-4 text-xs text-foreground overflow-x-auto whitespace-pre-wrap">{curlExample}</pre>
            </div>
          </TabsContent>
          <TabsContent value="js">
            <div className="relative">
              <CopyBtn text={jsExample} id="js" />
              <pre className="glass rounded-lg p-4 text-xs text-foreground overflow-x-auto whitespace-pre-wrap">{jsExample}</pre>
            </div>
          </TabsContent>
          <TabsContent value="python">
            <div className="relative">
              <CopyBtn text={pythonExample} id="python" />
              <pre className="glass rounded-lg p-4 text-xs text-foreground overflow-x-auto whitespace-pre-wrap">{pythonExample}</pre>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Response Example */}
      <div className="glass glow-border rounded-xl p-5 mb-6 animate-stagger-in" style={{ animationDelay: "0.15s" }}>
        <h2 className="text-sm font-bold text-foreground mb-3">Resposta de Sucesso (201)</h2>
        <div className="relative">
          <CopyBtn text={responseExample} id="response" />
          <pre className="glass rounded-lg p-4 text-xs text-foreground overflow-x-auto whitespace-pre-wrap">{responseExample}</pre>
        </div>
      </div>

      {/* Fields Table */}
      <div className="glass glow-border rounded-xl p-5 animate-stagger-in" style={{ animationDelay: "0.2s" }}>
        <h2 className="text-sm font-bold text-foreground mb-4">Campos do Payload</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/30">
                <TableHead className="text-xs">Campo</TableHead>
                <TableHead className="text-xs">Tipo</TableHead>
                <TableHead className="text-xs">Obrigatório</TableHead>
                <TableHead className="text-xs">Descrição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((f) => (
                <TableRow key={f.path} className="border-border/20">
                  <TableCell className="font-mono text-xs text-primary">{f.path}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{f.type}</TableCell>
                  <TableCell>
                    <Badge variant={f.required ? "default" : "secondary"} className={f.required ? "bg-primary/20 text-primary border-primary/30 text-[10px]" : "text-[10px]"}>
                      {f.required ? "Sim" : "Não"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{f.desc}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
