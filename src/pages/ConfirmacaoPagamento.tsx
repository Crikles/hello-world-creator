import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLoja } from "@/contexts/LojaContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import {
  Settings, History, BookOpen, Mail, MessageSquare, Loader2,
  CheckCircle2, XCircle, Coins, Type, Eye, Save, Sparkles,
  ShoppingCart, Globe, Gift, ArrowRight, User, Search,
  ChevronLeft, ChevronRight, Calendar,
} from "lucide-react";
import { format } from "date-fns";

/* ─── Color Picker ─── */
function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-medium text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1.5">
        <input type="color" value={value.length === 7 ? value : "#000000"} onChange={(e) => onChange(e.target.value)} className="w-7 h-7 rounded cursor-pointer border border-border/50" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="text-[10px] font-mono flex-1 bg-transparent border-border/50 h-7 px-1.5" />
      </div>
    </div>
  );
}

/* ─── Section Toggle ─── */
function SectionToggle({ label, icon: Icon, checked, onChange, children }: {
  label: string; icon: React.ElementType; checked: boolean; onChange: (v: boolean) => void; children?: React.ReactNode;
}) {
  return (
    <div className="glass glow-border rounded-xl p-4 animate-stagger-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">{label}</span>
        </div>
        <Switch checked={checked} onCheckedChange={onChange} />
      </div>
      {checked && children && <div className="space-y-3 mt-2">{children}</div>}
    </div>
  );
}

/* ─── Settings Type ─── */
interface ConfSettings {
  saudacao: string;
  mostrar_saudacao: boolean;
  mostrar_resumo: boolean;
  mensagem: string;
  mostrar_mensagem: boolean;
  mostrar_cta: boolean;
  texto_botao: string;
  url_cta: string;
  rodape: string;
  mostrar_rodape: boolean;
  cor_primaria: string;
  cor_texto: string;
}

const DEFAULTS: ConfSettings = {
  saudacao: "Olá {{nome}}, seu pagamento foi confirmado com sucesso!",
  mostrar_saudacao: true,
  mostrar_resumo: true,
  mensagem: "Seu pedido já está sendo processado. Em breve você receberá mais informações sobre o envio.",
  mostrar_mensagem: true,
  mostrar_cta: false,
  texto_botao: "Acompanhar Pedido",
  url_cta: "",
  rodape: "Obrigado pela sua compra!",
  mostrar_rodape: true,
  cor_primaria: "#16a34a",
  cor_texto: "#333333",
};

/* ─── Serialize / Parse metadata tags ─── */
function serializeToCorpo(s: ConfSettings): string {
  return [
    `{{conf_saudacao:${s.saudacao}}}`,
    `{{conf_mostrar_saudacao:${s.mostrar_saudacao}}}`,
    `{{conf_mostrar_resumo:${s.mostrar_resumo}}}`,
    `{{conf_mensagem:${s.mensagem}}}`,
    `{{conf_mostrar_mensagem:${s.mostrar_mensagem}}}`,
    `{{conf_mostrar_cta:${s.mostrar_cta}}}`,
    `{{conf_texto_botao:${s.texto_botao}}}`,
    `{{conf_url_cta:${s.url_cta}}}`,
    `{{conf_rodape:${s.rodape}}}`,
    `{{conf_mostrar_rodape:${s.mostrar_rodape}}}`,
    `{{conf_cor_primaria:${s.cor_primaria}}}`,
    `{{conf_cor_texto:${s.cor_texto}}}`,
  ].join("");
}

function parseFromCorpo(corpo: string): Partial<ConfSettings> {
  const m = (tag: string) => corpo.match(new RegExp(`\\{\\{${tag}:([^}]*)\\}\\}`))?.[1];
  const bool = (tag: string, def: boolean) => { const v = m(tag); return v === undefined ? def : v === "true"; };
  return {
    saudacao: m("conf_saudacao") || undefined,
    mostrar_saudacao: bool("conf_mostrar_saudacao", DEFAULTS.mostrar_saudacao),
    mostrar_resumo: bool("conf_mostrar_resumo", DEFAULTS.mostrar_resumo),
    mensagem: m("conf_mensagem") || undefined,
    mostrar_mensagem: bool("conf_mostrar_mensagem", DEFAULTS.mostrar_mensagem),
    mostrar_cta: bool("conf_mostrar_cta", DEFAULTS.mostrar_cta),
    texto_botao: m("conf_texto_botao") || undefined,
    url_cta: m("conf_url_cta") ?? undefined,
    rodape: m("conf_rodape") || undefined,
    mostrar_rodape: bool("conf_mostrar_rodape", DEFAULTS.mostrar_rodape),
    cor_primaria: m("conf_cor_primaria") || m("conf_cor_header") || undefined,
    cor_texto: m("conf_cor_texto") || undefined,
  };
}

/* ─── Build email HTML for preview ─── */
function buildPreviewHtml(s: ConfSettings, empresaNome: string, logoUrl: string): string {
  const sections: string[] = [];

  // Simple header line
  sections.push(`
    <tr><td style="padding:24px 32px 16px;border-bottom:2px solid ${s.cor_primaria};">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        ${logoUrl ? `<td style="width:40px;"><img src="${logoUrl}" alt="${empresaNome}" style="max-height:36px;border-radius:6px;" /></td>` : ""}
        <td style="padding-left:${logoUrl ? '12' : '0'}px;">
          <p style="margin:0;font-size:15px;font-weight:700;color:${s.cor_primaria};">Pagamento Confirmado</p>
          <p style="margin:2px 0 0;font-size:12px;color:#888;">${empresaNome}</p>
        </td>
      </tr></table>
    </td></tr>`);

  // Saudação
  if (s.mostrar_saudacao) {
    sections.push(`
    <tr><td style="padding:24px 32px 8px;">
      <p style="font-size:15px;color:#222;margin:0;line-height:1.5;">${replacePreviewVars(s.saudacao)}</p>
    </td></tr>`);
  }

  // Resumo
  if (s.mostrar_resumo) {
    sections.push(`
    <tr><td style="padding:12px 32px;">
      <table width="100%" cellpadding="8" cellspacing="0" style="background:#f9f9f9;border-radius:6px;border:1px solid #eee;">
        <tr><td style="color:#666;font-size:13px;">Produto</td><td style="color:#222;font-size:13px;font-weight:600;text-align:right;">Kit Skincare Premium</td></tr>
        <tr><td style="color:#666;font-size:13px;border-top:1px solid #eee;">Valor</td><td style="color:${s.cor_primaria};font-size:13px;font-weight:600;text-align:right;border-top:1px solid #eee;">R$ 197,00</td></tr>
      </table>
    </td></tr>`);
  }

  // Mensagem
  if (s.mostrar_mensagem && s.mensagem) {
    sections.push(`
    <tr><td style="padding:8px 32px;">
      <p style="font-size:14px;color:${s.cor_texto};margin:0;line-height:1.6;">${replacePreviewVars(s.mensagem)}</p>
    </td></tr>`);
  }

  // CTA
  if (s.mostrar_cta && s.texto_botao) {
    sections.push(`
    <tr><td style="padding:16px 32px;text-align:center;">
      <a href="#" style="display:inline-block;background:${s.cor_primaria};color:#ffffff;padding:10px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">
        ${s.texto_botao}
      </a>
    </td></tr>`);
  }

  // Rodapé
  if (s.mostrar_rodape) {
    sections.push(`
    <tr><td style="padding:20px 32px 24px;border-top:1px solid #eee;">
      <p style="font-size:12px;color:#999;margin:0;text-align:center;">${replacePreviewVars(s.rodape)}</p>
    </td></tr>`);
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:20px;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">
<tr><td><table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
${sections.join("")}
</table></td></tr></table></body></html>`;
}

function replacePreviewVars(text: string): string {
  return text
    .replace(/\{\{nome\}\}/g, "Maria")
    .replace(/\{\{nome_completo\}\}/g, "Maria Silva")
    .replace(/\{\{produto\}\}/g, "Kit Skincare Premium")
    .replace(/\{\{valor\}\}/g, "197,00")
    .replace(/\{\{empresa\}\}/g, "Minha Loja");
}

/* ─── Historico Tab with pagination + filters ─── */
const PER_PAGE = 10;

interface GroupedLog {
  pedido_id: string | null;
  nome: string;
  email: string;
  telefone: string;
  email_status: "sent" | "failed" | "none";
  sms_status: "sent" | "failed" | "none";
  custo_total: number;
  created_at: string;
}

function HistoricoTab({ logs, logsLoading }: { logs: any[]; logsLoading: boolean }) {
  const { loja } = useLoja();
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [page, setPage] = useState(1);

  // Fetch pedidos for client info
  const pedidoIds = useMemo(() => {
    const ids = new Set<string>();
    logs.forEach((l) => { if (l.pedido_id) ids.add(l.pedido_id); });
    return Array.from(ids);
  }, [logs]);

  const { data: pedidos } = useQuery({
    queryKey: ["confirmacao-pedidos", loja?.id, pedidoIds],
    queryFn: async () => {
      if (!pedidoIds.length) return [];
      const { data } = await supabase
        .from("pedidos")
        .select("id, customer_name, customer_email, customer_phone")
        .in("id", pedidoIds);
      return data || [];
    },
    enabled: !!loja && pedidoIds.length > 0,
  });

  const pedidoMap = useMemo(() => {
    const map: Record<string, any> = {};
    (pedidos || []).forEach((p) => { map[p.id] = p; });
    return map;
  }, [pedidos]);

  // Group logs by pedido_id (or by destinatario if no pedido_id)
  const grouped = useMemo(() => {
    const groups: Record<string, GroupedLog> = {};

    logs.forEach((log) => {
      const key = log.pedido_id || log.destinatario || log.id;

      if (!groups[key]) {
        const pedido = log.pedido_id ? pedidoMap[log.pedido_id] : null;
        groups[key] = {
          pedido_id: log.pedido_id,
          nome: pedido?.customer_name || "-",
          email: pedido?.customer_email || (log.tipo === "email" ? log.destinatario : ""),
          telefone: pedido?.customer_phone || (log.tipo === "sms" ? log.destinatario : ""),
          email_status: "none",
          sms_status: "none",
          custo_total: 0,
          created_at: log.created_at,
        };
      }

      const g = groups[key];
      g.custo_total += Number(log.custo || 0);

      if (log.tipo === "email") {
        g.email_status = log.status as "sent" | "failed";
        if (!g.email) g.email = log.destinatario;
      } else if (log.tipo === "sms") {
        g.sms_status = log.status as "sent" | "failed";
        if (!g.telefone) g.telefone = log.destinatario;
      }

      // Use earliest date
      if (log.created_at < g.created_at) g.created_at = log.created_at;
    });

    return Object.values(groups).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [logs, pedidoMap]);

  const filtered = useMemo(() => {
    let result = grouped;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((g) =>
        g.nome.toLowerCase().includes(q) ||
        g.email.toLowerCase().includes(q) ||
        g.telefone.includes(q)
      );
    }
    if (dateFilter) {
      result = result.filter((g) => g.created_at.startsWith(dateFilter));
    }
    return result;
  }, [grouped, search, dateFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  useEffect(() => { setPage(1); }, [search, dateFilter]);

  const StatusBadge = ({ status, type }: { status: string; type: "email" | "sms" }) => {
    const icon = type === "email" ? <Mail className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />;
    if (status === "sent") return (
      <Badge className="bg-green-500/10 text-green-600 gap-1">{icon} <CheckCircle2 className="h-3 w-3" /></Badge>
    );
    if (status === "failed") return (
      <Badge variant="destructive" className="gap-1">{icon} <XCircle className="h-3 w-3" /></Badge>
    );
    return <Badge variant="outline" className="gap-1 opacity-40">{icon} —</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de Confirmações</CardTitle>
        <CardDescription>Notificações enviadas por cliente</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="pl-9 w-full sm:w-44"
            />
          </div>
        </div>

        {logsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !filtered.length ? (
          <p className="text-center text-muted-foreground py-8">
            {logs.length ? "Nenhum resultado encontrado" : "Nenhuma confirmação enviada ainda"}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead className="text-center">Email</TableHead>
                    <TableHead className="text-center">SMS</TableHead>
                    <TableHead>Custo</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((g, idx) => (
                    <TableRow key={g.pedido_id || idx}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          {g.nome}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{g.email || "—"}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{g.telefone || "—"}</TableCell>
                      <TableCell className="text-center"><StatusBadge status={g.email_status} type="email" /></TableCell>
                      <TableCell className="text-center"><StatusBadge status={g.sms_status} type="sms" /></TableCell>
                      <TableCell>{g.custo_total.toFixed(2)}</TableCell>
                      <TableCell className="text-xs">{format(new Date(g.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                {filtered.length} cliente{filtered.length !== 1 ? "s" : ""} — Página {currentPage} de {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Main Component ─── */
export default function ConfirmacaoPagamento() {
  const { user } = useAuth();
  const { loja } = useLoja();
  const queryClient = useQueryClient();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [activeTab, setActiveTab] = useState("config");

  // Config query
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["confirmacao-config", loja?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("confirmacao_pagamento_config")
        .select("*")
        .eq("loja_id", loja!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!loja,
  });

  // Empresa query
  const { data: empresa } = useQuery({
    queryKey: ["empresa", loja?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("empresas")
        .select("*")
        .eq("loja_id", loja!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!loja,
  });

  // Costs query
  const { data: custos } = useQuery({
    queryKey: ["confirmacao-custos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_config")
        .select("key, value")
        .in("key", ["custo_confirmacao_email", "custo_confirmacao_sms"]);
      const map: Record<string, number> = {};
      (data || []).forEach((c) => { map[c.key] = c.value; });
      return map;
    },
  });

  // Log query
  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ["confirmacao-log", loja?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("confirmacao_pagamento_log")
        .select("*")
        .eq("loja_id", loja!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      return data || [];
    },
    enabled: !!loja,
  });

  // Local state
  const [ativo, setAtivo] = useState(false);
  const [enviarEmail, setEnviarEmail] = useState(true);
  const [enviarSms, setEnviarSms] = useState(true);
  const [assuntoEmail, setAssuntoEmail] = useState("Pagamento Confirmado! ✅ Seu pedido {{produto}} foi aprovado");
  const [smsTemplate, setSmsTemplate] = useState("Ola {{nome}}! Seu pagamento de R${{valor}} foi confirmado. Obrigado pela compra!");
  const [emailRemetenteNome, setEmailRemetenteNome] = useState("");
  const [settings, setSettings] = useState<ConfSettings>({ ...DEFAULTS });

  const set = <K extends keyof ConfSettings>(key: K, val: ConfSettings[K]) =>
    setSettings(prev => ({ ...prev, [key]: val }));

  const empresaNome = empresa?.nome_fantasia || empresa?.razao_social || "Minha Loja";
  const logoUrl = empresa?.logo_url || "";

  useEffect(() => {
    if (config) {
      setAtivo(config.ativo);
      setEnviarEmail(config.enviar_email);
      setEnviarSms(config.enviar_sms);
      setAssuntoEmail(config.assunto_email);
      setSmsTemplate(config.sms_template);
      setEmailRemetenteNome((config as any).email_remetente_nome || "");
      if (config.corpo_email && config.corpo_email.includes("{{conf_")) {
        const parsed = parseFromCorpo(config.corpo_email);
        setSettings(prev => ({ ...prev, ...parsed }));
      }
    }
  }, [config]);

  // Preview HTML
  const previewHtml = useMemo(() => buildPreviewHtml(settings, empresaNome, logoUrl), [settings, empresaNome, logoUrl]);

  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) { doc.open(); doc.write(previewHtml); doc.close(); }
    }
  }, [previewHtml]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const corpo = serializeToCorpo(settings);
      const payload = {
        loja_id: loja!.id,
        ativo,
        enviar_email: enviarEmail,
        enviar_sms: enviarSms,
        assunto_email: assuntoEmail,
        corpo_email: corpo,
        sms_template: smsTemplate,
      } as any;
      payload.email_remetente_nome = emailRemetenteNome;

      if (config) {
        await supabase
          .from("confirmacao_pagamento_config")
          .update(payload)
          .eq("id", config.id);
      } else {
        await supabase
          .from("confirmacao_pagamento_config")
          .insert(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["confirmacao-config", loja?.id] });
      toast({ title: "Configuração salva com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    },
  });

  const custoEmail = custos?.custo_confirmacao_email ?? 0.50;
  const custoSms = custos?.custo_confirmacao_sms ?? 0.12;

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Confirmação de Pagamento</h1>
        <p className="text-muted-foreground mt-1">
          Envie emails e SMS automáticos quando um pagamento é confirmado
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="h-4 w-4" /> Configuração
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-2">
            <History className="h-4 w-4" /> Histórico
          </TabsTrigger>
          <TabsTrigger value="tutorial" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Tutorial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" forceMount className={`space-y-4 mt-4 ${activeTab !== "config" ? "hidden" : ""}`}>
          {/* Status + Custos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Status da Funcionalidade</span>
                <div className="flex items-center gap-2">
                  <Label htmlFor="ativo-switch" className="text-sm text-muted-foreground">
                    {ativo ? "Ativo" : "Desativado"}
                  </Label>
                  <Switch id="ativo-switch" checked={ativo} onCheckedChange={setAtivo} />
                </div>
              </CardTitle>
              <CardDescription>
                Quando ativo, cada pedido pago envia automaticamente email e/ou SMS de confirmação
                <span className="ml-2">
                  <Badge variant="secondary"><Coins className="h-3 w-3 mr-1" /> Email: {custoEmail.toFixed(2)}</Badge>
                  {" "}
                  <Badge variant="secondary"><Coins className="h-3 w-3 mr-1" /> SMS: {custoSms.toFixed(2)}</Badge>
                </span>
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT: Editor */}
            <div className="space-y-4">
              {/* Email toggle + remetente */}
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Switch checked={enviarEmail} onCheckedChange={setEnviarEmail} />
                    <Label className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-primary" /> Enviar email de confirmação
                    </Label>
                  </div>

                  {enviarEmail && (
                    <>
                      <div>
                        <Label className="text-xs">Nome do Remetente (FROM)</Label>
                        <Input
                          value={emailRemetenteNome}
                          onChange={(e) => setEmailRemetenteNome(e.target.value)}
                          placeholder={empresaNome}
                          className="mt-1"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Aparecerá como: <strong>{emailRemetenteNome || empresaNome}</strong> &lt;contato@recuperacaodenegocios.com&gt;
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs">Assunto do Email</Label>
                        <Input
                          value={assuntoEmail}
                          onChange={(e) => setAssuntoEmail(e.target.value)}
                          placeholder="Pagamento Confirmado! ✅"
                          className="mt-1"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Variáveis: {"{{nome}}"}, {"{{produto}}"}, {"{{valor}}"}, {"{{empresa}}"}
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Visual Sections */}
              {enviarEmail && (
                <div className="space-y-3">
                  <SectionToggle label="Saudação" icon={Type} checked={settings.mostrar_saudacao} onChange={(v) => set("mostrar_saudacao", v)}>
                    <Textarea
                      value={settings.saudacao}
                      onChange={(e) => set("saudacao", e.target.value)}
                      className="text-sm min-h-[60px]"
                      placeholder="Olá {{nome}}, seu pagamento foi confirmado!"
                    />
                  </SectionToggle>

                  <SectionToggle label="Resumo do Pedido" icon={ShoppingCart} checked={settings.mostrar_resumo} onChange={(v) => set("mostrar_resumo", v)}>
                    <p className="text-xs text-muted-foreground">Mostra automaticamente o produto e valor do pedido</p>
                  </SectionToggle>

                  <SectionToggle label="Mensagem Principal" icon={Sparkles} checked={settings.mostrar_mensagem} onChange={(v) => set("mostrar_mensagem", v)}>
                    <Textarea
                      value={settings.mensagem}
                      onChange={(e) => set("mensagem", e.target.value)}
                      className="text-sm min-h-[60px]"
                      placeholder="Seu pedido está sendo processado..."
                    />
                  </SectionToggle>

                  <SectionToggle label="Botão CTA" icon={ArrowRight} checked={settings.mostrar_cta} onChange={(v) => set("mostrar_cta", v)}>
                    <Input value={settings.texto_botao} onChange={(e) => set("texto_botao", e.target.value)} placeholder="Acompanhar Pedido" className="text-sm" />
                    <Input value={settings.url_cta} onChange={(e) => set("url_cta", e.target.value)} placeholder="https://sualoja.com/rastreio" className="text-sm" />
                  </SectionToggle>

                  <SectionToggle label="Rodapé" icon={Globe} checked={settings.mostrar_rodape} onChange={(v) => set("mostrar_rodape", v)}>
                    <Input value={settings.rodape} onChange={(e) => set("rodape", e.target.value)} placeholder="Obrigado pela sua compra!" className="text-sm" />
                  </SectionToggle>

                  {/* Cores */}
                  <div className="glass glow-border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Eye className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm font-semibold text-foreground">Cores</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <ColorPicker label="Cor Principal" value={settings.cor_primaria} onChange={(v) => set("cor_primaria", v)} />
                      <ColorPicker label="Texto" value={settings.cor_texto} onChange={(v) => set("cor_texto", v)} />
                    </div>
                  </div>
                </div>
              )}

              {/* SMS */}
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Switch checked={enviarSms} onCheckedChange={setEnviarSms} />
                    <Label className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-primary" /> Enviar SMS de confirmação
                    </Label>
                  </div>
                  {enviarSms && (
                    <div>
                      <Label className="text-xs">Template do SMS</Label>
                      <Textarea
                        value={smsTemplate}
                        onChange={(e) => setSmsTemplate(e.target.value)}
                        placeholder="Mensagem do SMS..."
                        className="mt-1 min-h-[80px]"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Variáveis: {"{{nome}}"}, {"{{produto}}"}, {"{{valor}}"}, {"{{empresa}}"}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="w-full"
              >
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar Configuração
              </Button>
            </div>

            {/* RIGHT: Preview */}
            {enviarEmail && (
              <div className="space-y-4">
                {/* Inbox simulation */}
                <div className="rounded-xl border bg-card p-4 space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Preview da Caixa de Entrada
                  </p>
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Mail className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-foreground truncate">
                          {emailRemetenteNome || empresaNome}
                        </span>
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap ml-2">agora</span>
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">{replacePreviewVars(assuntoEmail)}</p>
                      <p className="text-xs text-muted-foreground truncate">{replacePreviewVars(settings.saudacao).substring(0, 90)}...</p>
                    </div>
                  </div>
                </div>

                {/* Email body preview */}
                <div className="rounded-xl border bg-muted/30 overflow-hidden" style={{ minHeight: 500 }}>
                  <div className="flex items-center gap-1.5 px-3 py-2 border-b bg-card">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                    <span className="text-[10px] text-muted-foreground ml-2">Email Preview</span>
                  </div>
                  <iframe
                    ref={iframeRef}
                    title="Email Preview"
                    className="w-full border-0"
                    sandbox="allow-same-origin"
                    style={{ minHeight: 470 }}
                  />
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <HistoricoTab logs={logs || []} logsLoading={logsLoading} />
        </TabsContent>

        <TabsContent value="tutorial" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Como funciona?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">1. Ative a funcionalidade</h3>
                <p>Vá na aba Configuração e ative o switch principal. Escolha se deseja enviar email, SMS ou ambos.</p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">2. Personalize visualmente</h3>
                <p>Use o editor visual para customizar cada seção do email. O preview ao lado mostra em tempo real como ficará.</p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">3. Automático!</h3>
                <p>
                  Quando um pedido é pago via webhook (qualquer checkout integrado), o sistema
                  automaticamente envia a confirmação para o cliente.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">4. Preencha os dados da empresa</h3>
                <p>
                  Para que o email fique personalizado com a sua marca, preencha os dados
                  da empresa na página <strong>Empresa</strong> (logo, nome fantasia, etc).
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Coins className="h-4 w-4 text-primary" /> Custos
                </h3>
                <p>• Email de confirmação: <strong>{custoEmail.toFixed(2)} moedas</strong> por envio</p>
                <p>• SMS de confirmação: <strong>{custoSms.toFixed(2)} moedas</strong> por envio</p>
                <p className="text-xs">Os créditos são debitados automaticamente da sua carteira.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
