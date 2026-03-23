import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Check, BookOpen, Terminal, Code2, FileCode2, Braces, Key, Send, AlertTriangle, HelpCircle, ChevronDown, ChevronUp, Play, Loader2, PackageOpen, Info, Zap, Shield, Globe } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ENDPOINT_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-external`;

const fields = [
  { path: "customer.name", type: "string", required: true, desc: "Nome completo do cliente" },
  { path: "customer.email", type: "string", required: true, desc: "E-mail válido do cliente" },
  { path: "customer.document", type: "string", required: false, desc: "CPF ou CNPJ (apenas números)" },
  { path: "customer.phone", type: "string", required: false, desc: "Telefone com DDD (apenas números)" },
  { path: "address.street", type: "string", required: false, desc: "Rua / Logradouro" },
  { path: "address.number", type: "string", required: false, desc: "Número" },
  { path: "address.neighborhood", type: "string", required: false, desc: "Bairro" },
  { path: "address.city", type: "string", required: false, desc: "Cidade" },
  { path: "address.state", type: "string", required: false, desc: "Estado (UF, 2 letras)" },
  { path: "address.zipcode", type: "string", required: false, desc: "CEP (apenas números, 8 dígitos)" },
  { path: "address.complement", type: "string", required: false, desc: "Complemento (apto, bloco, etc)" },
  { path: "items[].name", type: "string", required: true, desc: "Nome do produto" },
  { path: "items[].quantity", type: "number", required: false, desc: "Quantidade (padrão: 1)" },
  { path: "items[].price", type: "number", required: false, desc: "Preço unitário em R$" },
  { path: "total", type: "number", required: false, desc: "Valor total. Se omitido, é calculado automaticamente" },
];

const errorExamples = [
  { status: 400, title: "Token ausente", example: `{ "error": "Missing 'token' query parameter" }`, desc: "O parâmetro ?token= não foi enviado na URL." },
  { status: 401, title: "Token inválido", example: `{ "error": "Invalid token. Store not found." }`, desc: "O token informado não corresponde a nenhuma loja cadastrada." },
  { status: 405, title: "Método não permitido", example: `{ "error": "Method not allowed. Use POST." }`, desc: "A requisição usou GET, PUT ou outro método. Use apenas POST." },
  { status: 422, title: "Validação falhou", example: `{\n  "error": "Validation failed",\n  "details": [\n    "'customer.name' is required and must be a non-empty string",\n    "'customer.email' is required and must be a valid email"\n  ]\n}`, desc: "Campos obrigatórios ausentes ou com formato inválido." },
  { status: 500, title: "Erro interno", example: `{ "error": "Internal server error" }`, desc: "Erro inesperado no servidor. Tente novamente ou contate o suporte." },
];

const faqItems = [
  { q: "Onde encontro meu token?", a: "Acesse sua conta no painel Magnus Frete, vá em Integrações e copie o token da sua loja." },
  { q: "Posso enviar múltiplos pedidos de uma vez?", a: "Cada requisição cria um pedido. Para envios em lote, faça múltiplas requisições em sequência." },
  { q: "O código de rastreio é gerado automaticamente?", a: "Sim! A API retorna o código de rastreio na resposta de sucesso." },
  { q: "Preciso enviar todos os campos?", a: "Não. Apenas customer.name, customer.email e items[].name são obrigatórios. Os demais são opcionais." },
  { q: "Qual o limite de requisições?", a: "Cada requisição consome 1 crédito da sua conta. Não há limite de taxa, mas recomendamos espaçar requisições em lote." },
];

const payloadJson = `{
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
    {
      "name": "Tênis Sport Max – Edição \\"Urban\\" (3 Cores) - 42 / Branco",
      "quantity": 1,
      "price": 199.90
    },
    {
      "name": "Mochila Impermeável Pro - Preta",
      "quantity": 2,
      "price": 129.90
    },
    {
      "name": "Óculos de Sol – Coleção Verão",
      "quantity": 1,
      "price": 89.90
    }
  ],
  "total": 549.60
}`;

const responseExample = `{
  "success": true,
  "pedido_id": "uuid-do-pedido",
  "envio_id": "uuid-do-envio",
  "codigo_rastreio": "BR1A2B3C4D5EJL"
}`;

function sanitizeJson(text: string): string {
  return text
    .replace(/\u201C|\u201D/g, '"')  // smart double quotes
    .replace(/\u2018|\u2019/g, "'")  // smart single quotes
    .replace(/\u2013/g, "-")         // en dash
    .replace(/\u2014/g, "-");        // em dash
}

export default function DocumentacaoPublica() {
  const [token, setToken] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [testPayload, setTestPayload] = useState(payloadJson);
  const [testResult, setTestResult] = useState<any>(null);
  const [testStatus, setTestStatus] = useState<number | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const handleTestRequest = async () => {
    if (!token) return;
    const cleaned = sanitizeJson(testPayload);
    try {
      JSON.parse(cleaned);
      setJsonError(null);
    } catch {
      setJsonError("JSON inválido. Verifique a sintaxe.");
      return;
    }
    setTestLoading(true);
    setTestResult(null);
    setTestStatus(null);
    try {
      const res = await fetch(`${ENDPOINT_BASE}?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: cleaned,
      });
      const data = await res.json();
      setTestStatus(res.status);
      setTestResult(data);
    } catch (err: any) {
      setTestStatus(0);
      setTestResult({ error: err.message || "Erro de rede" });
    } finally {
      setTestLoading(false);
    }
  };

  const displayToken = token || "SEU_TOKEN";
  const fullUrl = `${ENDPOINT_BASE}?token=${displayToken}`;

  const curlExample = `curl -X POST "${fullUrl}" \\
  -H "Content-Type: application/json" \\
  -d '${payloadJson}'`;

  const jsExample = `const response = await fetch("${fullUrl}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(${payloadJson})
});

const data = await response.json();
console.log(data.codigo_rastreio);`;

  const pythonExample = `import requests

response = requests.post(
    "${fullUrl}",
    json=${payloadJson}
)

data = response.json()
print(data["codigo_rastreio"])`;

  const phpExample = `<?php
$url = "${fullUrl}";
$data = ${payloadJson};

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));

$response = curl_exec($ch);
curl_close($ch);

$result = json_decode($response, true);
echo $result['codigo_rastreio'];`;

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
      className="absolute top-2 right-2 h-7 w-7 border border-border/30 bg-background/50 hover:bg-background"
      onClick={() => copyText(text, id)}
    >
      {copiedKey === id ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
    </Button>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="border-b border-border/40 bg-gradient-to-b from-primary/5 to-background">
        <div className="max-w-7xl mx-auto px-4 py-10 md:py-14">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <Badge variant="outline" className="border-primary/30 text-primary text-xs">API v1</Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Documentação da API
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Integre seu sistema diretamente com o Magnus Frete. Envie pedidos via HTTP POST e receba códigos de rastreio automaticamente.
          </p>

          {/* Token Input */}
          <div className="mt-6 max-w-lg">
            <div className="flex items-center gap-2 mb-2">
              <Key className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-foreground">Seu Token</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Cole seu token para que os exemplos e o sandbox sejam atualizados. Encontre em <strong>Integrações → API Externa</strong>.
            </p>
            <Input
              placeholder="Cole seu token aqui..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
        </div>
      </div>

      {/* Split Layout */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,440px] gap-8">
          {/* LEFT — Documentation */}
          <div className="space-y-8 min-w-0">
            {/* Endpoint */}
            <section className="rounded-xl border border-border/40 bg-card p-6">
              <div className="flex items-center gap-2 mb-3">
                <Send className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">Endpoint</h2>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shrink-0">POST</Badge>
                <code className="text-xs text-foreground bg-muted/50 px-3 py-2 rounded-lg break-all flex-1">{fullUrl}</code>
                <Button variant="outline" size="icon" className="shrink-0 h-8 w-8" onClick={() => copyText(fullUrl, "url")}>
                  {copiedKey === "url" ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Envie uma requisição <code className="text-primary">POST</code> com o body JSON contendo os dados do pedido. O token deve ser enviado como query parameter na URL.
              </p>
            </section>

            {/* Code Examples */}
            <section className="rounded-xl border border-border/40 bg-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Code2 className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">Exemplos de Integração</h2>
              </div>
              <Tabs defaultValue="curl" className="w-full">
                <TabsList className="bg-muted/50 mb-4">
                  <TabsTrigger value="curl" className="gap-1.5 text-xs"><Terminal className="h-3.5 w-3.5" />cURL</TabsTrigger>
                  <TabsTrigger value="js" className="gap-1.5 text-xs"><Code2 className="h-3.5 w-3.5" />JavaScript</TabsTrigger>
                  <TabsTrigger value="python" className="gap-1.5 text-xs"><FileCode2 className="h-3.5 w-3.5" />Python</TabsTrigger>
                  <TabsTrigger value="php" className="gap-1.5 text-xs"><Braces className="h-3.5 w-3.5" />PHP</TabsTrigger>
                </TabsList>
                {[
                  { key: "curl", code: curlExample },
                  { key: "js", code: jsExample },
                  { key: "python", code: pythonExample },
                  { key: "php", code: phpExample },
                ].map(({ key, code }) => (
                  <TabsContent key={key} value={key}>
                    <div className="relative">
                      <CopyBtn text={code} id={key} />
                      <pre className="bg-muted/30 border border-border/20 rounded-lg p-4 text-xs text-foreground overflow-x-auto whitespace-pre-wrap">{code}</pre>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </section>

            {/* Success Response */}
            <section className="rounded-xl border border-border/40 bg-card p-6">
              <div className="flex items-center gap-2 mb-3">
                <Check className="h-4 w-4 text-emerald-400" />
                <h2 className="text-sm font-bold text-foreground">Resposta de Sucesso</h2>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">201 Created</Badge>
              </div>
              <div className="relative">
                <CopyBtn text={responseExample} id="response" />
                <pre className="bg-muted/30 border border-border/20 rounded-lg p-4 text-xs text-foreground overflow-x-auto whitespace-pre-wrap">{responseExample}</pre>
              </div>
            </section>

            {/* Multiple Products */}
            <section className="rounded-xl border border-border/40 bg-card p-6">
              <div className="flex items-center gap-2 mb-3">
                <PackageOpen className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">Múltiplos Produtos</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                A API aceita <strong>múltiplos produtos</strong> no array <code className="text-primary text-xs">items[]</code>. Veja como eles aparecem no painel:
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/20 border border-border/20">
                  <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div className="text-xs text-muted-foreground space-y-1.5">
                    <p><strong className="text-foreground">Campo "Produto" no envio:</strong> Todos os itens são exibidos como uma lista no painel. Ex: <code className="text-primary bg-muted/40 px-1 rounded">Tênis Sport Max (1x), Mochila Impermeável (2x)</code></p>
                    <p><strong className="text-foreground">Quantidade total:</strong> É a soma de todas as quantidades dos itens. Se você enviar 1 + 2 + 1 = <strong>4 unidades</strong> no total.</p>
                    <p><strong className="text-foreground">Valor total:</strong> Se o campo <code className="text-primary bg-muted/40 px-1 rounded">total</code> for omitido, o sistema calcula automaticamente: <code className="text-primary bg-muted/40 px-1 rounded">Σ (price × quantity)</code> de cada item.</p>
                  </div>
                </div>
                <div className="bg-muted/30 border border-border/20 rounded-lg p-4">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Exemplo — como aparece no painel</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground">📦 Tênis Sport Max – Edição "Urban" - 42 / Branco</span>
                      <span className="text-muted-foreground">1x · R$ 199,90</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground">📦 Mochila Impermeável Pro - Preta</span>
                      <span className="text-muted-foreground">2x · R$ 129,90</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground">📦 Óculos de Sol – Coleção Verão</span>
                      <span className="text-muted-foreground">1x · R$ 89,90</span>
                    </div>
                    <div className="border-t border-border/30 mt-2 pt-2 flex justify-between text-xs font-semibold">
                      <span className="text-foreground">Total: 4 unidades</span>
                      <span className="text-primary">R$ 549,60</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  <strong>Dica:</strong> Caracteres especiais como acentos (ã, é), aspas ("..."), traços (–) e barras (/) são totalmente suportados nos nomes dos produtos.
                </p>
              </div>
            </section>


            <section className="rounded-xl border border-border/40 bg-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Braces className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">Campos do Payload</h2>
              </div>
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
            </section>

            {/* Error Responses */}
            <section className="rounded-xl border border-border/40 bg-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <h2 className="text-sm font-bold text-foreground">Respostas de Erro</h2>
              </div>
              <div className="space-y-4">
                {errorExamples.map((err) => (
                  <div key={err.status} className="bg-muted/20 border border-border/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="destructive" className="text-[10px]">{err.status}</Badge>
                      <span className="text-xs font-semibold text-foreground">{err.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{err.desc}</p>
                    <pre className="bg-muted/30 border border-border/10 rounded-md p-3 text-xs text-foreground overflow-x-auto whitespace-pre-wrap">{err.example}</pre>
                  </div>
                ))}
              </div>
            </section>

            {/* FAQ */}
            <section className="rounded-xl border border-border/40 bg-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <HelpCircle className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">Perguntas Frequentes</h2>
              </div>
              <div className="space-y-2">
                {faqItems.map((item, i) => (
                  <div key={i} className="border border-border/20 rounded-lg overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    >
                      <span className="text-sm font-medium text-foreground">{item.q}</span>
                      {openFaq === i ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                    </button>
                    {openFaq === i && (
                      <div className="px-4 pb-3">
                        <p className="text-sm text-muted-foreground">{item.a}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Footer */}
            <div className="text-center py-8 text-xs text-muted-foreground">
              <p>Magnus Frete — API v1</p>
              <p className="mt-1">Dúvidas? Entre em contato pelo painel em <strong>Suporte</strong>.</p>
            </div>
          </div>

          {/* RIGHT — Sandbox */}
          <div className="order-first lg:order-last">
            <div className="lg:sticky lg:top-4 space-y-4">
              <div className="rounded-xl border-2 border-primary/30 bg-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Play className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-bold text-foreground">Testar API</h2>
                  <Badge variant="outline" className="border-primary/30 text-primary text-[10px]">Live</Badge>
                </div>

                <div className="flex items-center gap-2 mb-4 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  <p className="text-[11px] text-destructive">Este teste cria um pedido real na sua conta.</p>
                </div>

                {/* Full request preview */}
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Request</label>
                    <div className="bg-muted/30 border border-border/20 rounded-lg p-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] shrink-0">POST</Badge>
                        <code className="text-[10px] text-foreground break-all">{`${ENDPOINT_BASE}?token=${displayToken}`}</code>
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        Content-Type: application/json
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Body (JSON editável)</label>
                    <Textarea
                      value={testPayload}
                      onChange={(e) => { setTestPayload(e.target.value); setJsonError(null); }}
                      className="font-mono text-[11px] min-h-[260px] leading-relaxed"
                      spellCheck={false}
                    />
                    {jsonError && <p className="text-xs text-destructive mt-1">{jsonError}</p>}
                  </div>

                  <Button
                    onClick={handleTestRequest}
                    disabled={!token || testLoading}
                    className="w-full gap-2"
                    size="sm"
                  >
                    {testLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {testLoading ? "Enviando..." : !token ? "Insira seu token acima" : "Enviar Requisição"}
                  </Button>
                </div>
              </div>

              {/* Response */}
              {testResult && (
                <div className="rounded-xl border border-border/40 bg-card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Resposta</span>
                    <Badge className={testStatus && testStatus >= 200 && testStatus < 300
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]"
                      : "bg-destructive/20 text-destructive border-destructive/30 text-[10px]"
                    }>
                      {testStatus === 0 ? "Erro de rede" : `${testStatus}`}
                    </Badge>
                  </div>
                  <pre className="bg-muted/30 border border-border/20 rounded-lg p-3 text-[11px] text-foreground overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(testResult, null, 2)}
                  </pre>
                  {testResult.codigo_rastreio && (
                    <div className="mt-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-400" />
                      <span className="text-xs text-foreground">Rastreio: <strong className="text-primary">{testResult.codigo_rastreio}</strong></span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
