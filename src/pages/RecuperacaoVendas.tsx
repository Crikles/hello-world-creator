import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLoja } from "@/contexts/LojaContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import {
  Copy, Mail, ShoppingCart, Clock, Gift, Eye, Download,
  Save, MessageSquare, Globe, Type, Sparkles, Coins,
  CheckCircle2, ArrowRight, Lock, DollarSign, Smartphone, AlertTriangle,
  BookOpen, Zap, Shield, Timer, Hash, ExternalLink, Info, Trash2,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";

/* ─── Color Picker ─── */
function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-medium text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1.5">
        <input type="color" value={value.length === 9 ? value.slice(0, 7) : (value.length === 7 ? value : "#000000")} onChange={(e) => onChange(e.target.value)} className="w-7 h-7 rounded cursor-pointer border border-border/50" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="text-[10px] font-mono flex-1 bg-transparent border-border/50 h-7 px-1.5" />
      </div>
    </div>
  );
}

/* ─── Settings Type ─── */
interface RecoverySettings {
  ativo: boolean;
  delay_minutos: number;
  assunto_email: string;
  mostrar_saudacao: boolean;
  saudacao: string;
  mostrar_resumo_pedido: boolean;
  mostrar_texto_interrupcao: boolean;
  texto_interrupcao: string;
  mostrar_beneficios: boolean;
  beneficio_principal: string;
  beneficio_1: string;
  beneficio_2: string;
  beneficio_3: string;
  mostrar_cupom: boolean;
  codigo_cupom: string;
  descricao_cupom: string;
  mostrar_garantia: boolean;
  garantia: string;
  mostrar_cta: boolean;
  texto_botao: string;
  url_cta: string;
  mostrar_ps: boolean;
  ps_reforco_urgencia: string;
  cor_botao: string;
  cor_destaque: string;
  cor_titulo: string;
  cor_texto: string;
  cor_fundo_cupom: string;
  cor_borda_cupom: string;
  cor_cupom_texto: string;
}

const DEFAULTS_CARRINHO: RecoverySettings = {
  ativo: false,
  delay_minutos: 30,
  assunto_email: "{{nome_cliente}}, você esqueceu algo 👀",
  mostrar_saudacao: true,
  saudacao: "Percebemos que você deixou algo importante no seu carrinho — e achamos que vale te avisar antes que você perca isso.",
  mostrar_resumo_pedido: true,
  mostrar_texto_interrupcao: true,
  texto_interrupcao: "Talvez algo tenha te interrompido… Pode ter sido dúvida, falta de tempo ou só aquele \"depois eu vejo\".",
  mostrar_beneficios: true,
  beneficio_principal: "transformar sua rotina",
  beneficio_1: "Resultados visíveis em 7 dias",
  beneficio_2: "Fórmula testada e aprovada",
  beneficio_3: "Satisfação garantida",
  mostrar_cupom: false,
  codigo_cupom: "VOLTE10",
  descricao_cupom: "10% OFF na sua compra",
  mostrar_garantia: true,
  garantia: "7 dias de garantia incondicional",
  mostrar_cta: true,
  texto_botao: "Finalizar meu pedido",
  url_cta: "",
  mostrar_ps: true,
  ps_reforco_urgencia: "Esse link expira em 24h. Garanta agora!",
  cor_botao: "#6366f1",
  cor_destaque: "#6366f1",
  cor_titulo: "#0f172a",
  cor_texto: "#334155",
  cor_fundo_cupom: "#fff3cd",
  cor_borda_cupom: "#ffc107",
  cor_cupom_texto: "#d63384",
};

const DEFAULTS_PIX: RecoverySettings = {
  ...DEFAULTS_CARRINHO,
  assunto_email: "{{nome_cliente}}, seu PIX está aguardando 💲",
  saudacao: "Notamos que você gerou um PIX mas ainda não finalizou o pagamento. Seu pedido está reservado por tempo limitado!",
  texto_interrupcao: "Sabemos que imprevistos acontecem. Mas seu pedido ainda está disponível — finalize agora antes que expire.",
  texto_botao: "Pagar com PIX agora",
  ps_reforco_urgencia: "O PIX gerado expira em breve. Não perca seu pedido!",
};

/* ─── Build email HTML from settings (for preview) ─── */
function buildEmailHtml(s: RecoverySettings, empresaNome: string, logoUrl: string, tipo?: string): string {
  const sections: string[] = [];

  sections.push(`
    <tr><td style="padding:32px 40px 16px;text-align:center;">
      ${logoUrl ? `<img src="${logoUrl}" alt="${empresaNome}" style="width:56px;height:56px;border-radius:16px;object-fit:cover;margin-bottom:8px;" />` : ""}
      <p style="margin:0;font-size:13px;font-weight:700;color:${s.cor_destaque};letter-spacing:0.5px;">${empresaNome}</p>
    </td></tr>`);

  if (s.mostrar_saudacao) {
    sections.push(`
    <tr><td style="padding:8px 40px 16px;">
      <h2 style="margin:0 0 12px;font-size:20px;font-weight:800;color:${s.cor_titulo};">Olá, {{nome_cliente}} 👋</h2>
      <p style="margin:0;font-size:14px;line-height:1.7;color:${s.cor_texto};">${s.saudacao}</p>
    </td></tr>`);
  }

  if (s.mostrar_resumo_pedido) {
    sections.push(`
    <tr><td style="padding:8px 40px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border-radius:12px;border:1px solid #e2e8f0;">
        <tr><td style="padding:16px;">
          <p style="margin:0 0 8px;font-weight:700;font-size:13px;color:${s.cor_titulo};">🛒 Resumo do seu pedido:</p>
          <p style="margin:0;font-size:13px;color:${s.cor_texto};line-height:1.7;">{{lista_produtos}}</p>
          <p style="margin:12px 0 0;font-size:18px;font-weight:800;color:${s.cor_titulo};">💰 {{valor_total}}</p>
        </td></tr>
      </table>
    </td></tr>`);
  }

  if (tipo === "pix_pendente") {
    sections.push(`
    <tr><td style="padding:8px 40px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border-radius:12px;border:1px solid #e2e8f0;">
        <tr><td style="padding:20px;text-align:center;">
          <p style="margin:0 0 12px;font-weight:700;font-size:14px;color:${s.cor_titulo};">📱 Escaneie o QR Code ou copie o código abaixo:</p>
          <div style="width:160px;height:160px;margin:0 auto 16px;background:#e2e8f0;border-radius:12px;display:flex;align-items:center;justify-content:center;">
            <table width="160" height="160" cellpadding="0" cellspacing="0" style="background:#e2e8f0;border-radius:12px;">
              <tr><td align="center" valign="middle" style="font-size:40px;">📷</td></tr>
              <tr><td align="center" valign="middle" style="font-size:11px;color:#64748b;padding:0 8px;">QR Code PIX</td></tr>
            </table>
          </div>
          <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:${s.cor_titulo};">Código Copia e Cola:</p>
          <div style="background:#f1f5f9;border:1px dashed #cbd5e1;border-radius:8px;padding:12px 16px;word-break:break-all;font-family:'Courier New',monospace;font-size:11px;color:#334155;line-height:1.5;text-align:left;">
            00020101021226860014br.gov.bcb.pix2564qrpix...exemplo...630470B5
          </div>
        </td></tr>
      </table>
    </td></tr>`);
  }

  if (s.mostrar_texto_interrupcao) {
    sections.push(`
    <tr><td style="padding:8px 40px 16px;">
      <p style="margin:0;font-size:14px;line-height:1.7;color:${s.cor_texto};">${s.texto_interrupcao}</p>
    </td></tr>`);
  }

  if (s.mostrar_beneficios) {
    sections.push(`
    <tr><td style="padding:8px 40px 16px;">
      <p style="margin:0 0 8px;font-size:14px;color:${s.cor_texto};">👉 O que você estava prestes a garantir não é só um produto. É uma forma de <strong style="color:${s.cor_destaque};">${s.beneficio_principal}</strong>.</p>
      <p style="margin:0;font-size:14px;color:${s.cor_texto};line-height:1.8;">
        ✔️ ${s.beneficio_1}<br/>
        ✔️ ${s.beneficio_2}<br/>
        ✔️ ${s.beneficio_3}
      </p>
    </td></tr>`);
  }

  if (s.mostrar_cupom) {
    sections.push(`
    <tr><td style="padding:8px 40px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:${s.cor_fundo_cupom};border:2px dashed ${s.cor_borda_cupom};border-radius:12px;">
        <tr><td style="padding:20px;text-align:center;">
          <p style="font-weight:700;margin:0 0 4px;font-size:13px;color:${s.cor_titulo};">🎁 Tem um incentivo pra você voltar agora:</p>
          <p style="font-size:28px;font-weight:800;color:${s.cor_cupom_texto};margin:8px 0;letter-spacing:2px;">${s.codigo_cupom}</p>
          <p style="margin:0;font-size:13px;color:${s.cor_texto};">💸 ${s.descricao_cupom}</p>
          <p style="font-size:11px;color:#999;margin-top:8px;">⏳ Esse cupom pode expirar a qualquer momento.</p>
        </td></tr>
      </table>
    </td></tr>`);
  }

  if (s.mostrar_garantia) {
    sections.push(`
    <tr><td style="padding:8px 40px 16px;">
      <p style="margin:0;font-size:14px;line-height:1.7;color:${s.cor_texto};">Se ainda existe alguma dúvida, fique tranquilo: <strong>${s.garantia}</strong>.</p>
    </td></tr>`);
  }

  if (s.mostrar_cta) {
    sections.push(`
    <tr><td style="padding:16px 40px 24px;text-align:center;">
      <a href="${s.url_cta || '{{link_checkout}}'}" style="display:inline-block;background:${s.cor_botao};color:#ffffff;padding:14px 36px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.3px;">
        👉 ${s.texto_botao}
      </a>
    </td></tr>`);
  }

  if (s.mostrar_ps) {
    sections.push(`
    <tr><td style="padding:0 40px 24px;">
      <p style="margin:0;font-size:12px;color:#94a3b8;font-style:italic;">P.S.: ${s.ps_reforco_urgencia}</p>
    </td></tr>`);
  }

  sections.push(`
    <tr><td style="padding:16px 40px;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">Enviado por <strong>${empresaNome}</strong></p>
    </td></tr>`);

  return `<!DOCTYPE html><html><body style="margin:0;padding:20px;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;">
<tr><td><table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
${sections.join("")}
</table></td></tr></table></body></html>`;
}

function replacePreviewVars(html: string): string {
  const vars: Record<string, string> = {
    nome_cliente: "Maria Silva",
    lista_produtos: "Kit Skincare Premium (x1) — R$ 197,00<br>Sérum Vitamina C (x1) — R$ 89,00",
    nome_produto_principal: "Kit Skincare Premium",
    valor_total: "R$ 286,00",
    link_checkout: "#",
  };
  let result = html;
  for (const [k, v] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v);
  }
  return result;
}

function serializeToCorpo(s: RecoverySettings): string {
  return [
    `{{recovery_mostrar_saudacao:${s.mostrar_saudacao}}}`,
    `{{recovery_saudacao:${s.saudacao}}}`,
    `{{recovery_mostrar_resumo:${s.mostrar_resumo_pedido}}}`,
    `{{recovery_mostrar_interrupcao:${s.mostrar_texto_interrupcao}}}`,
    `{{recovery_texto_interrupcao:${s.texto_interrupcao}}}`,
    `{{recovery_mostrar_beneficios:${s.mostrar_beneficios}}}`,
    `{{recovery_mostrar_cupom:${s.mostrar_cupom}}}`,
    `{{recovery_mostrar_garantia:${s.mostrar_garantia}}}`,
    `{{recovery_mostrar_cta:${s.mostrar_cta}}}`,
    `{{recovery_texto_botao:${s.texto_botao}}}`,
    `{{recovery_url_cta:${s.url_cta}}}`,
    `{{recovery_mostrar_ps:${s.mostrar_ps}}}`,
    `{{recovery_cor_botao:${s.cor_botao}}}`,
    `{{recovery_cor_destaque:${s.cor_destaque}}}`,
    `{{recovery_cor_titulo:${s.cor_titulo}}}`,
    `{{recovery_cor_texto:${s.cor_texto}}}`,
    `{{recovery_cor_fundo_cupom:${s.cor_fundo_cupom}}}`,
    `{{recovery_cor_borda_cupom:${s.cor_borda_cupom}}}`,
    `{{recovery_cor_cupom_texto:${s.cor_cupom_texto}}}`,
  ].join("");
}

function parseFromCorpo(corpo: string, defaults: RecoverySettings): Partial<RecoverySettings> {
  const m = (tag: string) => corpo.match(new RegExp(`\\{\\{${tag}:([^}]*)\\}\\}`))?.[1];
  const bool = (tag: string, def: boolean) => { const v = m(tag); return v === undefined ? def : v === "true"; };
  return {
    mostrar_saudacao: bool("recovery_mostrar_saudacao", defaults.mostrar_saudacao),
    saudacao: m("recovery_saudacao") || defaults.saudacao,
    mostrar_resumo_pedido: bool("recovery_mostrar_resumo", defaults.mostrar_resumo_pedido),
    mostrar_texto_interrupcao: bool("recovery_mostrar_interrupcao", defaults.mostrar_texto_interrupcao),
    texto_interrupcao: m("recovery_texto_interrupcao") || defaults.texto_interrupcao,
    mostrar_beneficios: bool("recovery_mostrar_beneficios", defaults.mostrar_beneficios),
    mostrar_cupom: bool("recovery_mostrar_cupom", defaults.mostrar_cupom),
    mostrar_garantia: bool("recovery_mostrar_garantia", defaults.mostrar_garantia),
    mostrar_cta: bool("recovery_mostrar_cta", defaults.mostrar_cta),
    texto_botao: m("recovery_texto_botao") || defaults.texto_botao,
    url_cta: m("recovery_url_cta") || defaults.url_cta,
    mostrar_ps: bool("recovery_mostrar_ps", defaults.mostrar_ps),
    cor_botao: m("recovery_cor_botao") || defaults.cor_botao,
    cor_destaque: m("recovery_cor_destaque") || defaults.cor_destaque,
    cor_titulo: m("recovery_cor_titulo") || defaults.cor_titulo,
    cor_texto: m("recovery_cor_texto") || defaults.cor_texto,
    cor_fundo_cupom: m("recovery_cor_fundo_cupom") || defaults.cor_fundo_cupom,
    cor_borda_cupom: m("recovery_cor_borda_cupom") || defaults.cor_borda_cupom,
    cor_cupom_texto: m("recovery_cor_cupom_texto") || defaults.cor_cupom_texto,
  };
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

/* ─── Recovery Editor (reusable for both tipos) ─── */
function RecoveryEditor({ tipo, loja, empresaNome, logoUrl }: {
  tipo: "carrinho" | "pix_pendente";
  loja: { id: string; webhook_token: string };
  empresaNome: string;
  logoUrl: string;
}) {
  const queryClient = useQueryClient();
  const defaults = tipo === "pix_pendente" ? DEFAULTS_PIX : DEFAULTS_CARRINHO;
  const [settings, setSettings] = useState<RecoverySettings>({ ...defaults });
  const [savedSettings, setSavedSettings] = useState<RecoverySettings>({ ...defaults });

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-recovery?token=${loja.webhook_token}&tipo=${tipo}`;

  const set = <K extends keyof RecoverySettings>(key: K, val: RecoverySettings[K]) =>
    setSettings(prev => ({ ...prev, [key]: val }));

  // Fetch config for this tipo
  const { data: config } = useQuery({
    queryKey: ["recovery-config", loja.id, tipo],
    queryFn: async () => {
      const query = supabase
        .from("recovery_config")
        .select("*")
        .eq("loja_id", loja.id) as any;
      const { data } = await query.eq("tipo", tipo).maybeSingle();
      return data;
    },
  });

  // Populate from DB
  useEffect(() => {
    if (config) {
      const parsed = config.corpo_email ? parseFromCorpo(config.corpo_email, defaults) : {};
      const loaded: RecoverySettings = {
        ...defaults,
        ativo: config.ativo,
        delay_minutos: config.delay_minutos,
        assunto_email: config.assunto_email,
        beneficio_principal: config.beneficio_principal || defaults.beneficio_principal,
        beneficio_1: config.beneficio_1 || defaults.beneficio_1,
        beneficio_2: config.beneficio_2 || defaults.beneficio_2,
        beneficio_3: config.beneficio_3 || defaults.beneficio_3,
        garantia: config.garantia || defaults.garantia,
        ps_reforco_urgencia: config.ps_reforco_urgencia || defaults.ps_reforco_urgencia,
        mostrar_cupom: config.cupom_ativo,
        codigo_cupom: config.codigo_cupom || defaults.codigo_cupom,
        descricao_cupom: config.descricao_cupom || defaults.descricao_cupom,
        ...parsed,
      };
      setSettings(loaded);
      setSavedSettings(loaded);
    } else {
      setSettings({ ...defaults });
      setSavedSettings({ ...defaults });
    }
  }, [config]);

  const hasChanges = useMemo(() => JSON.stringify(settings) !== JSON.stringify(savedSettings), [settings, savedSettings]);

  // Save
  const saveMutation = useMutation({
    mutationFn: async () => {
      const corpo = serializeToCorpo(settings);
      const payload: Record<string, unknown> = {
        loja_id: loja.id,
        ativo: settings.ativo,
        delay_minutos: settings.delay_minutos,
        assunto_email: settings.assunto_email,
        corpo_email: corpo,
        cupom_ativo: settings.mostrar_cupom,
        codigo_cupom: settings.codigo_cupom,
        descricao_cupom: settings.descricao_cupom,
        beneficio_principal: settings.beneficio_principal,
        beneficio_1: settings.beneficio_1,
        beneficio_2: settings.beneficio_2,
        beneficio_3: settings.beneficio_3,
        garantia: settings.garantia,
        ps_reforco_urgencia: settings.ps_reforco_urgencia,
        tipo,
      };

      if (config) {
        const { error } = await supabase.from("recovery_config").update(payload).eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("recovery_config").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setSavedSettings({ ...settings });
      queryClient.invalidateQueries({ queryKey: ["recovery-config", loja.id, tipo] });
      toast({ title: "Configuração salva!" });
    },
    onError: () => {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    },
  });

  // Leads for this tipo
  const { data: leads = [] } = useQuery({
    queryKey: ["recovery-leads", loja.id, tipo],
    queryFn: async () => {
      const query = supabase
        .from("recovery_leads")
        .select("*")
        .eq("loja_id", loja.id) as any;
      const { data } = await query
        .eq("tipo", tipo)
        .order("created_at", { ascending: false })
        .limit(200);
      return data || [];
    },
  });

  // Delete lead
  const deleteMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const { error } = await supabase.from("recovery_leads").delete().eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recovery-leads", loja.id, tipo] });
      toast({ title: "Lead excluído!" });
    },
    onError: () => toast({ title: "Erro ao excluir", variant: "destructive" }),
  });

  // Delete all leads
  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const query = supabase.from("recovery_leads").delete().eq("loja_id", loja.id) as any;
      const { error } = await query.eq("tipo", tipo);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recovery-leads", loja.id, tipo] });
      toast({ title: "Todos os leads excluídos!" });
    },
    onError: () => toast({ title: "Erro ao excluir", variant: "destructive" }),
  });

  const getLeadStatus = (lead: any) => {
    if (lead.status === "convertido") return { label: "Convertido", color: "bg-green-500/10 text-green-600" };
    if (lead.status === "sem_credito") return { label: "Sem crédito", color: "bg-red-500/10 text-red-600" };
    if (lead.status === "expirado") return { label: "Expirado", color: "bg-muted text-muted-foreground" };
    if (lead.email_sent_at && lead.sms_sent_at) return { label: "Email + SMS ✓", color: "bg-blue-500/10 text-blue-600" };
    if (lead.email_sent_at) return { label: "Email ✓", color: "bg-blue-500/10 text-blue-600" };
    if (lead.sms_sent_at) return { label: "SMS ✓", color: "bg-indigo-500/10 text-indigo-600" };
    return { label: "Pendente", color: "bg-yellow-500/10 text-yellow-600" };
  };

  const statusColors: Record<string, string> = {
    pendente: "bg-yellow-500/10 text-yellow-600",
    email_enviado: "bg-blue-500/10 text-blue-600",
    convertido: "bg-green-500/10 text-green-600",
    expirado: "bg-muted text-muted-foreground",
    sem_credito: "bg-red-500/10 text-red-600",
  };

  const previewHtml = useMemo(() => {
    const raw = buildEmailHtml(settings, empresaNome, logoUrl, tipo);
    return replacePreviewVars(raw);
  }, [settings, empresaNome, logoUrl]);

  const tipoLabel = tipo === "pix_pendente" ? "PIX Pendente" : "Carrinho Abandonado";

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-xs">Ativar {tipoLabel}</Label>
          <Switch checked={settings.ativo} onCheckedChange={v => set("ativo", v)} />
        </div>
      </div>

      {/* Webhook URL */}
      <div className="glass glow-border rounded-xl p-4">
        <div className="flex items-center gap-3">
          <Globe className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground mb-0.5">Webhook — {tipoLabel}</p>
            <code className="text-[10px] bg-muted px-2 py-0.5 rounded block truncate">{webhookUrl}</code>
          </div>
          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast({ title: "URL copiada!" }); }}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">⚙️ Email</TabsTrigger>
          <TabsTrigger value="leads">📋 Leads ({leads.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="config">
          <div className="grid lg:grid-cols-2 gap-5">
            {/* LEFT — Configuration */}
            <div className="space-y-3">
              <div className="glass glow-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Mail className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Configuração Geral</p>
                    <p className="text-[10px] text-muted-foreground">Assunto e timing do email</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Assunto do Email</Label>
                    <Input value={settings.assunto_email} onChange={e => set("assunto_email", e.target.value)} className="mt-1 text-sm bg-transparent border-border/50" />
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
                    <Zap className="h-4 w-4 text-primary" />
                    <span className="text-xs text-primary font-medium">Envio instantâneo — disparado assim que o lead chega</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/30">
                    <ColorPicker label="Títulos" value={settings.cor_titulo} onChange={v => set("cor_titulo", v)} />
                    <ColorPicker label="Texto" value={settings.cor_texto} onChange={v => set("cor_texto", v)} />
                    <ColorPicker label="Destaque" value={settings.cor_destaque} onChange={v => set("cor_destaque", v)} />
                  </div>
                </div>
              </div>

              {/* Variables Reference Card */}
              <div className="glass glow-border rounded-xl p-4 animate-stagger-in">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Hash className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Variáveis Disponíveis</p>
                    <p className="text-[10px] text-muted-foreground">Clique para copiar e use no assunto ou textos</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { tag: "{{nome_cliente}}", desc: "Nome do cliente" },
                    { tag: "{{lista_produtos}}", desc: "Lista de produtos" },
                    { tag: "{{valor_total}}", desc: "Valor total" },
                    { tag: "{{link_checkout}}", desc: "Link do checkout" },
                    { tag: "{{nome_produto_principal}}", desc: "Produto principal" },
                    { tag: "{{codigo_cupom}}", desc: "Código do cupom" },
                  ].map(v => (
                    <button
                      key={v.tag}
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(v.tag); toast({ title: `Copiado: ${v.tag}` }); }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 hover:bg-primary/20 text-[10px] font-mono text-primary transition-colors cursor-pointer border border-primary/20"
                      title={v.desc}
                    >
                      <Copy className="h-2.5 w-2.5" />
                      {v.tag}
                    </button>
                  ))}
                </div>
              </div>

              <SectionToggle label="Saudação" icon={Type} checked={settings.mostrar_saudacao} onChange={v => set("mostrar_saudacao", v)}>
                <Textarea value={settings.saudacao} onChange={e => set("saudacao", e.target.value)} maxLength={300} className="text-sm resize-none bg-transparent border-border/50" rows={3} />
                <p className="text-[10px] text-muted-foreground text-right">{settings.saudacao.length}/300</p>
              </SectionToggle>

              <SectionToggle label="Resumo do Pedido" icon={ShoppingCart} checked={settings.mostrar_resumo_pedido} onChange={v => set("mostrar_resumo_pedido", v)} />

              <SectionToggle label="Texto de Interrupção" icon={MessageSquare} checked={settings.mostrar_texto_interrupcao} onChange={v => set("mostrar_texto_interrupcao", v)}>
                <Textarea value={settings.texto_interrupcao} onChange={e => set("texto_interrupcao", e.target.value)} maxLength={300} className="text-sm resize-none bg-transparent border-border/50" rows={2} />
              </SectionToggle>

              <SectionToggle label="Benefícios" icon={Sparkles} checked={settings.mostrar_beneficios} onChange={v => set("mostrar_beneficios", v)}>
                <div>
                  <Label className="text-xs text-muted-foreground">Benefício Principal</Label>
                  <Input value={settings.beneficio_principal} onChange={e => set("beneficio_principal", e.target.value)} className="mt-1 text-sm bg-transparent border-border/50" />
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <Input value={settings.beneficio_1} onChange={e => set("beneficio_1", e.target.value)} placeholder="Benefício 1" className="text-sm bg-transparent border-border/50" />
                  <Input value={settings.beneficio_2} onChange={e => set("beneficio_2", e.target.value)} placeholder="Benefício 2" className="text-sm bg-transparent border-border/50" />
                  <Input value={settings.beneficio_3} onChange={e => set("beneficio_3", e.target.value)} placeholder="Benefício 3" className="text-sm bg-transparent border-border/50" />
                </div>
              </SectionToggle>

              <SectionToggle label="Cupom de Desconto" icon={Gift} checked={settings.mostrar_cupom} onChange={v => set("mostrar_cupom", v)}>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Código</Label>
                    <Input value={settings.codigo_cupom} onChange={e => set("codigo_cupom", e.target.value)} className="mt-1 text-sm bg-transparent border-border/50" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Descrição</Label>
                    <Input value={settings.descricao_cupom} onChange={e => set("descricao_cupom", e.target.value)} className="mt-1 text-sm bg-transparent border-border/50" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/30">
                  <ColorPicker label="Fundo" value={settings.cor_fundo_cupom} onChange={v => set("cor_fundo_cupom", v)} />
                  <ColorPicker label="Borda" value={settings.cor_borda_cupom} onChange={v => set("cor_borda_cupom", v)} />
                  <ColorPicker label="Texto" value={settings.cor_cupom_texto} onChange={v => set("cor_cupom_texto", v)} />
                </div>
              </SectionToggle>

              <SectionToggle label="Garantia" icon={CheckCircle2} checked={settings.mostrar_garantia} onChange={v => set("mostrar_garantia", v)}>
                <Input value={settings.garantia} onChange={e => set("garantia", e.target.value)} className="text-sm bg-transparent border-border/50" />
              </SectionToggle>

              <SectionToggle label="Botão (CTA)" icon={ArrowRight} checked={settings.mostrar_cta} onChange={v => set("mostrar_cta", v)}>
                <Input value={settings.texto_botao} onChange={e => set("texto_botao", e.target.value)} placeholder="Texto do botão" className="text-sm bg-transparent border-border/50" />
                <div className="pt-2 border-t border-border/30 space-y-2">
                  <div>
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" /> URL do Botão
                      {!settings.url_cta && <Badge variant="secondary" className="ml-1 text-[8px] px-1 py-0">Automático</Badge>}
                    </Label>
                    <Input
                      value={settings.url_cta}
                      onChange={e => set("url_cta", e.target.value)}
                      placeholder="https://... (vazio = URL do checkout capturada)"
                      className="mt-1 text-sm bg-transparent border-border/50"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                      <Info className="h-3 w-3 shrink-0" />
                      Por padrão, direciona para a URL do checkout/PIX capturada automaticamente. Altere apenas se quiser redirecionar para outro link.
                    </p>
                  </div>
                  <ColorPicker label="Cor do Botão" value={settings.cor_botao} onChange={v => set("cor_botao", v)} />
                </div>
              </SectionToggle>

              <SectionToggle label="P.S. (Urgência)" icon={Lock} checked={settings.mostrar_ps} onChange={v => set("mostrar_ps", v)}>
                <Input value={settings.ps_reforco_urgencia} onChange={e => set("ps_reforco_urgencia", e.target.value)} className="text-sm bg-transparent border-border/50" />
              </SectionToggle>


              <Button onClick={() => saveMutation.mutate()} disabled={!hasChanges || saveMutation.isPending} className="w-full shimmer-btn" size="lg">
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>

            {/* RIGHT — Preview */}
            <div className="space-y-4">
              <div className="glass glow-border rounded-xl p-4 flex flex-col sticky top-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Eye className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Preview do Email</p>
                    <p className="text-[10px] text-muted-foreground">Visualização em tempo real</p>
                  </div>
                </div>

                <div className="bg-[#f1f5f9] rounded-2xl border-2 border-border/50 shadow-xl overflow-hidden flex flex-col" style={{ minHeight: 500 }}>
                  <div className="bg-white border-b border-black/5 px-4 py-3 flex items-center gap-3 shadow-sm z-10">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-400" />
                      <div className="w-3 h-3 rounded-full bg-amber-400" />
                      <div className="w-3 h-3 rounded-full bg-green-400" />
                    </div>
                    <div className="flex flex-col ml-2">
                      <span className="text-[11px] font-bold" style={{ color: '#000000' }}>
                        {settings.assunto_email.replace("{{nome_cliente}}", "Maria Silva")}
                      </span>
                      <span className="text-[9px] text-muted-foreground">Para: maria.silva@gmail.com</span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto bg-[#f1f5f9]">
                    <div className="p-3">
                      <div className="max-w-[560px] mx-auto transform scale-[0.85] origin-top">
                        <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHtml) }} />
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted/50 border-t border-border/50 px-4 py-2 text-center">
                    <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Preview visual do E-mail</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="leads" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total", value: leads.length, color: "text-foreground" },
              { label: "Pendentes", value: leads.filter((l: any) => l.status === "pendente" && !l.email_sent_at && !l.sms_sent_at).length, color: "text-yellow-600" },
              { label: "Disparados", value: leads.filter((l: any) => l.email_sent_at || l.sms_sent_at || l.status === "email_enviado").length, color: "text-blue-600" },
              { label: "Convertidos", value: leads.filter((l: any) => l.status === "convertido").length, color: "text-green-600" },
            ].map(s => (
              <Card key={s.label} className="glass">
                <CardContent className="py-3 text-center">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              const csv = [
                ["Nome", "Email", "Telefone", "Produto", "Valor", "Status", "Data"].join(","),
                ...leads.map(l => {
                  const prods = (l.products as { name: string }[] || []).map(p => p.name).join(" + ");
                  return [`"${l.customer_name}"`, l.customer_email, l.customer_phone || "", `"${prods}"`, l.total_value, l.status, format(new Date(l.created_at), "dd/MM/yyyy HH:mm")].join(",");
                }),
              ].join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
              a.download = `recovery_${tipo}_${format(new Date(), "yyyyMMdd")}.csv`; a.click();
            }}>
              <Download className="h-4 w-4 mr-2" /> Exportar CSV
            </Button>
            {leads.length > 0 && (
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => { if (confirm("Excluir TODOS os leads? Esta ação não pode ser desfeita.")) deleteAllMutation.mutate(); }}>
                <Trash2 className="h-4 w-4 mr-2" /> Excluir Todos
              </Button>
            )}
          </div>

          {leads.length === 0 ? (
            <Card className="glass">
              <CardContent className="py-8 text-center text-muted-foreground">
                <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>Nenhum lead capturado ainda.</p>
                <p className="text-xs mt-1">Configure o webhook no checkout para capturar leads.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {leads.map(lead => {
                const prods = (lead.products as { name: string; qty: number }[] || []);
                return (
                  <Card key={lead.id} className="glass">
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{lead.customer_name || "—"}</span>
                            {(() => { const s = getLeadStatus(lead); return <Badge variant="outline" className={s.color}>{s.label}</Badge>; })()}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{lead.customer_email}</p>
                          {prods.length > 0 && <p className="text-xs text-muted-foreground mt-0.5 truncate">{prods.map(p => p.name).join(", ")}</p>}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="font-semibold text-sm">R$ {Number(lead.total_value || 0).toFixed(2).replace(".", ",")}</p>
                            <p className="text-xs text-muted-foreground">{format(new Date(lead.created_at), "dd/MM HH:mm")}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(lead.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─── SMS Editor (both tipos in one tab) ─── */
function SmsEditor({ loja }: { loja: { id: string } }) {
  const queryClient = useQueryClient();

  const SMS_VARS = [
    { var: "{nome}", desc: "Primeiro nome" },
    { var: "{produto}", desc: "Nome do produto" },
    { var: "{link}", desc: "Link do checkout" },
  ];

  const { data: configCarrinho } = useQuery({
    queryKey: ["recovery-config", loja.id, "carrinho"],
    queryFn: async () => {
      const { data } = await (supabase.from("recovery_config").select("*").eq("loja_id", loja.id) as any).eq("tipo", "carrinho").maybeSingle();
      return data;
    },
  });

  const { data: configPix } = useQuery({
    queryKey: ["recovery-config", loja.id, "pix_pendente"],
    queryFn: async () => {
      const { data } = await (supabase.from("recovery_config").select("*").eq("loja_id", loja.id) as any).eq("tipo", "pix_pendente").maybeSingle();
      return data;
    },
  });

  const [smsCarrinho, setSmsCarrinho] = useState({ ativo: false, template: "Oi {nome}, voce deixou {produto} no carrinho! Finalize agora: {link}" });
  const [smsPix, setSmsPix] = useState({ ativo: false, template: "Oi {nome}, seu PIX para {produto} ainda esta pendente. Pague agora: {link}" });
  const [savedCarrinho, setSavedCarrinho] = useState({ ...smsCarrinho });
  const [savedPix, setSavedPix] = useState({ ...smsPix });

  useEffect(() => {
    if (configCarrinho) {
      const s = { ativo: configCarrinho.enviar_sms || false, template: configCarrinho.sms_template || smsCarrinho.template };
      setSmsCarrinho(s);
      setSavedCarrinho(s);
    }
  }, [configCarrinho]);

  useEffect(() => {
    if (configPix) {
      const s = { ativo: configPix.enviar_sms || false, template: configPix.sms_template || smsPix.template };
      setSmsPix(s);
      setSavedPix(s);
    }
  }, [configPix]);

  const hasChanges = JSON.stringify(smsCarrinho) !== JSON.stringify(savedCarrinho) || JSON.stringify(smsPix) !== JSON.stringify(savedPix);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = [
        { config: configCarrinho, tipo: "carrinho" as const, sms: smsCarrinho },
        { config: configPix, tipo: "pix_pendente" as const, sms: smsPix },
      ];
      for (const u of updates) {
        const payload = { enviar_sms: u.sms.ativo, sms_template: u.sms.template };
        if (u.config) {
          const { error } = await supabase.from("recovery_config").update(payload).eq("id", u.config.id);
          if (error) throw error;
        } else {
          const defaults = u.tipo === "pix_pendente" ? DEFAULTS_PIX : DEFAULTS_CARRINHO;
          const { error } = await supabase.from("recovery_config").insert({
            loja_id: loja.id,
            tipo: u.tipo,
            ...payload,
            assunto_email: defaults.assunto_email,
            corpo_email: "",
          } as any);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      setSavedCarrinho({ ...smsCarrinho });
      setSavedPix({ ...smsPix });
      queryClient.invalidateQueries({ queryKey: ["recovery-config", loja.id] });
      toast({ title: "SMS salvo!" });
    },
    onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
  });

  function SmsBlock({ label, icon, sms, onChange }: {
    label: string;
    icon?: React.ReactNode;
    sms: { ativo: boolean; template: string };
    onChange: (s: { ativo: boolean; template: string }) => void;
  }) {
    const charPercent = Math.round((sms.template.length / 160) * 100);
    return (
      <div className="glass glow-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              {icon || <Smartphone className="h-4 w-4 text-primary" />}
            </div>
            <div>
              <span className="text-sm font-semibold text-foreground">{label}</span>
              <p className="text-[10px] text-muted-foreground">Ative para enviar SMS automático</p>
            </div>
          </div>
          <Switch checked={sms.ativo} onCheckedChange={v => onChange({ ...sms, ativo: v })} />
        </div>

        {sms.ativo && (
          <div className="space-y-3">
            <Textarea
              value={sms.template}
              onChange={e => {
                if (e.target.value.length <= 160) onChange({ ...sms, template: e.target.value });
              }}
              maxLength={160}
              className="text-sm resize-none bg-transparent border-border/50 font-mono min-h-[80px]"
              rows={3}
            />
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1.5 flex-wrap">
                {SMS_VARS.map(v => (
                  <button
                    key={v.var}
                    type="button"
                    className="text-[11px] bg-primary/10 text-primary px-2 py-1 rounded-md font-mono hover:bg-primary/20 transition-colors border border-primary/20"
                    onClick={() => {
                      if ((sms.template + v.var).length <= 160) {
                        onChange({ ...sms, template: sms.template + v.var });
                      }
                    }}
                    title={v.desc}
                  >
                    {v.var}
                  </button>
                ))}
              </div>
              <span className={`text-xs font-mono font-semibold ${sms.template.length > 150 ? "text-red-500" : "text-muted-foreground"}`}>
                {sms.template.length}/160
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full h-1.5 bg-border/30 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${charPercent > 93 ? "bg-red-500" : charPercent > 75 ? "bg-yellow-500" : "bg-primary"}`}
                style={{ width: `${Math.min(charPercent, 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              <code>{"{nome}"}</code> = primeiro nome · <code>{"{produto}"}</code> = nome do produto · <code>{"{link}"}</code> = link do checkout
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass glow-border rounded-xl p-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Configuração de SMS</h2>
            <p className="text-xs text-muted-foreground">Configure os templates de SMS para cada tipo de recuperação</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left column: SMS editors */}
        <div className="space-y-4">
          <SmsBlock
            label="SMS — PIX Pendente"
            icon={<DollarSign className="h-4 w-4 text-primary" />}
            sms={smsPix}
            onChange={setSmsPix}
          />

          <Button onClick={() => saveMutation.mutate()} disabled={!hasChanges || saveMutation.isPending} className="w-full shimmer-btn" size="lg">
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? "Salvando..." : "Salvar SMS"}
          </Button>
        </div>

        {/* Right column: Rules + tips */}
        <div className="space-y-4">
          {/* Rules */}
          <div className="rounded-xl border-2 border-yellow-500/40 bg-yellow-500/5 p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <p className="text-sm font-bold text-yellow-600 dark:text-yellow-300">Regras do SMS</p>
            </div>
            <ul className="text-sm text-muted-foreground space-y-2.5">
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 mt-0.5 shrink-0">•</span>
                <span>Limite de <strong className="text-foreground">160 caracteres</strong> inclui os valores reais das variáveis após substituição.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 mt-0.5 shrink-0">•</span>
                <span><strong className="text-foreground">Sem acentos</strong> (á, é, ã, ç) — use "voce" em vez de "você".</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 mt-0.5 shrink-0">•</span>
                <span><strong className="text-foreground">Sem emojis</strong> e caracteres especiais — apenas texto plano.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 mt-0.5 shrink-0">•</span>
                <span>Se ultrapassar 160 caracteres com dados reais, o SMS <strong className="text-foreground">não será enviado</strong>.</span>
              </li>
            </ul>
            <p className="text-xs text-yellow-600 dark:text-yellow-500 italic">
              💡 Mantenha templates curtos e sem acentos para garantir o envio.
            </p>
          </div>

          {/* Envio instantâneo */}
          <div className="glass glow-border rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Envio Instantâneo</h3>
                <p className="text-[10px] text-muted-foreground">Sem delay — disparo imediato</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              O SMS é disparado <strong className="text-foreground">instantaneamente</strong> assim que o lead é capturado pelo webhook. Não há fila ou delay — a conversão acontece na hora.
            </p>
          </div>

          {/* Custos */}
          <div className="glass glow-border rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Coins className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Custo por SMS</h3>
                <p className="text-[10px] text-muted-foreground">Cobrado apenas no envio efetivo</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-primary/5 rounded-lg p-3 text-center border border-primary/10">
                <p className="text-lg font-bold text-primary">0,15</p>
                <p className="text-[10px] text-muted-foreground">moedas / Carrinho</p>
              </div>
              <div className="bg-primary/5 rounded-lg p-3 text-center border border-primary/10">
                <p className="text-lg font-bold text-primary">0,15</p>
                <p className="text-[10px] text-muted-foreground">moedas / PIX</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export default function RecuperacaoVendas() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { loja } = useLoja();

  useEffect(() => {
    if (user && user.email !== "vdklanca@gmail.com") {
      navigate(loja ? `/loja/${loja.id}` : "/lojas", { replace: true });
    }
  }, [user, loja, navigate]);

  const { data: empresa } = useQuery({
    queryKey: ["empresa-recovery", loja?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("empresas")
        .select("nome_fantasia, razao_social, logo_url")
        .eq("loja_id", loja!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!loja,
  });

  const empresaNome = empresa?.nome_fantasia || empresa?.razao_social || "Minha Loja";
  const logoUrl = empresa?.logo_url || "";

  if (!loja) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <ShoppingCart className="h-4 w-4 text-primary" />
          </div>
          Recuperação de Vendas
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Recupere vendas abandonadas com emails e SMS personalizados</p>
      </div>

      <Tabs defaultValue="pix_pendente">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="pix_pendente" className="flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" />
            PIX Pendente
          </TabsTrigger>
          <TabsTrigger value="sms" className="flex items-center gap-1.5">
            <Smartphone className="h-3.5 w-3.5" />
            SMS
          </TabsTrigger>
          <TabsTrigger value="tutorial" className="flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            Tutorial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pix_pendente">
          <RecoveryEditor tipo="pix_pendente" loja={loja} empresaNome={empresaNome} logoUrl={logoUrl} />
        </TabsContent>

        <TabsContent value="sms">
          <SmsEditor loja={loja} />
        </TabsContent>

        <TabsContent value="tutorial">
          <TutorialTab webhookToken={loja.webhook_token} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─── Tutorial Tab ─── */
function TutorialTab({ webhookToken }: { webhookToken: string }) {
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-recovery?token=${webhookToken}&tipo=`;
  const [copied, setCopied] = useState<string | null>(null);

  const copyUrl = (tipo: string) => {
    navigator.clipboard.writeText(webhookUrl + tipo);
    setCopied(tipo);
    toast({ title: "URL copiada!" });
    setTimeout(() => setCopied(null), 2000);
  };

  const checkouts = [
    { name: "Vega", qrcode: true, copiaECola: true, urlCheckout: true },
    { name: "Zedy", qrcode: false, copiaECola: false, urlCheckout: false },
    { name: "Luna", qrcode: false, copiaECola: false, urlCheckout: true },
    { name: "Corvex", qrcode: false, copiaECola: false, urlCheckout: true },
    { name: "Adoorei", qrcode: false, copiaECola: false, urlCheckout: true },
    { name: "Shopify", qrcode: false, copiaECola: false, urlCheckout: true },
  ];

  const emailVars = [
    { var: "{{nome_cliente}}", desc: "Nome do cliente" },
    { var: "{{lista_produtos}}", desc: "Lista dos produtos do carrinho/pedido" },
    { var: "{{valor_total}}", desc: "Valor total formatado (R$ XX,XX)" },
    { var: "{{link_checkout}}", desc: "Link para finalizar a compra" },
  ];

  const smsVars = [
    { var: "{nome}", desc: "Primeiro nome do cliente" },
    { var: "{produto}", desc: "Nome do produto principal" },
    { var: "{link}", desc: "Link do checkout" },
  ];

  const steps = [
    { icon: Globe, title: "Checkout detecta PIX pendente", desc: "Quando um cliente gera um PIX sem pagar, o checkout envia um webhook automaticamente." },
    { icon: Zap, title: "Lead é capturado", desc: "O sistema recebe o webhook, normaliza os dados e salva o lead com status 'pendente'." },
    { icon: Mail, title: "E-mail é enviado instantaneamente", desc: "Um e-mail personalizado é disparado imediatamente com os dados do pedido, benefícios, cupom (se ativo) e CTA para voltar ao checkout." },
    { icon: Smartphone, title: "SMS é enviado (opcional)", desc: "Se configurado, um SMS curto também é disparado instantaneamente com link direto para o checkout." },
    { icon: CheckCircle2, title: "Cliente finaliza", desc: "O cliente recebe a comunicação, clica no link e finaliza o pagamento." },
  ];

  return (
    <div className="space-y-6 animate-stagger-in">
      {/* Custos do Serviço */}
      <Card className="glass glow-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Coins className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Custos do Serviço</h2>
              <p className="text-xs text-muted-foreground">Valores cobrados por envio efetivo</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-border/40 bg-muted/20 p-4 text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">E-mail</span>
              </div>
              <p className="text-2xl font-bold text-primary">0,10</p>
              <p className="text-[10px] text-muted-foreground">moedas por envio</p>
              <div className="flex gap-2 justify-center mt-1">
                <Badge variant="outline" className="text-[9px]">PIX Pendente</Badge>
              </div>
            </div>
            <div className="rounded-xl border border-border/40 bg-muted/20 p-4 text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">SMS</span>
              </div>
              <p className="text-2xl font-bold text-primary">0,15</p>
              <p className="text-[10px] text-muted-foreground">moedas por envio</p>
              <div className="flex gap-2 justify-center mt-1">
                <Badge variant="outline" className="text-[9px]">PIX Pendente</Badge>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-3 text-center">
            Valores podem ser personalizados pelo administrador. Cobrado apenas no envio efetivo.
          </p>
        </CardContent>
      </Card>

      {/* O que é */}
      <Card className="glass glow-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Info className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">O que é a Recuperação de Vendas?</h2>
              <p className="text-xs text-muted-foreground">Entenda o conceito e como funciona</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            A Recuperação de Vendas é um sistema automatizado que captura leads de clientes que <strong className="text-foreground">geraram um PIX sem pagar</strong>. O sistema envia automaticamente e-mails e/ou SMS personalizados para trazer o cliente de volta e finalizar o pagamento.
          </p>
        </CardContent>
      </Card>

      {/* Fluxo */}
      <Card className="glass glow-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ArrowRight className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Como funciona o fluxo</h2>
              <p className="text-xs text-muted-foreground">Passo a passo do processo de recuperação</p>
            </div>
          </div>
          <div className="grid gap-3">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/30">
                <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
                  <step.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">{i + 1}</span>
                    <span className="text-sm font-semibold text-foreground">{step.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Checkouts compatíveis */}
      <Card className="glass glow-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Checkouts com integração nativa</h2>
              <p className="text-xs text-muted-foreground">Estes checkouts já detectam e enviam leads automaticamente</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Checkout</th>
                  <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground">Carrinho</th>
                  <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground">PIX</th>
                  <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground">QR Code</th>
                  <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground">Copia e Cola</th>
                  <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground">URL Checkout</th>
                </tr>
              </thead>
              <tbody>
                {checkouts.map((c) => (
                  <tr key={c.name} className="border-b border-border/10">
                    <td className="py-2.5 px-2 font-medium text-foreground">{c.name}</td>
                    <td className="py-2.5 px-2 text-center">
                      {c.carrinho ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      {c.pix ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      {c.qrcode ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      {c.copiaECola ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      {c.urlCheckout ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            <strong>Nota:</strong> Checkouts que não enviam QR Code e Copia e Cola mostrarão apenas o botão de pagamento no e-mail de recuperação.
          </p>
        </CardContent>
      </Card>

      {/* Como configurar */}
      <Card className="glass glow-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Como configurar</h2>
              <p className="text-xs text-muted-foreground">Passo a passo para ativar a recuperação</p>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { step: "1", text: "Vá na aba 'Carrinho Abandonado' ou 'PIX Pendente' e ative o toggle de recuperação." },
              { step: "2", text: "Personalize o e-mail: saudação, benefícios, cupom (opcional), garantia e texto do botão CTA." },
              { step: "3", text: "Ajuste as cores para combinar com a identidade da sua loja." },
              { step: "4", text: "Na aba 'SMS', configure o template de SMS se quiser enviar SMS além do e-mail." },
              { step: "5", text: "Salve as configurações. O envio é instantâneo — assim que o lead chegar, ele já receberá a comunicação!" },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/20">
                <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{item.step}</span>
                <p className="text-sm text-muted-foreground leading-relaxed pt-0.5">{item.text}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Webhook genérico */}
      <Card className="glass glow-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ExternalLink className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Webhook genérico (outros checkouts)</h2>
              <p className="text-xs text-muted-foreground">Para checkouts sem integração nativa</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            Se seu checkout não está na lista acima, você pode usar o webhook genérico. Configure o checkout para enviar um <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded text-xs font-mono">POST</code> para a URL abaixo com os dados do cliente.
          </p>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground mb-1 block">URL para Carrinho Abandonado:</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono bg-muted/30 border border-border/30 rounded-lg p-2.5 text-foreground break-all">{webhookUrl}carrinho</code>
                <Button size="sm" variant="outline" onClick={() => copyUrl("carrinho")} className="flex-shrink-0">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground mb-1 block">URL para PIX Pendente:</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono bg-muted/30 border border-border/30 rounded-lg p-2.5 text-foreground break-all">{webhookUrl}pix_pendente</code>
                <Button size="sm" variant="outline" onClick={() => copyUrl("pix_pendente")} className="flex-shrink-0">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
          <div className="mt-4 p-3 rounded-lg bg-muted/20 border border-border/20">
            <p className="text-xs font-semibold text-foreground mb-2">Campos aceitos no payload JSON:</p>
            <code className="text-[11px] font-mono text-muted-foreground leading-relaxed block whitespace-pre">{`{
  "customer": {
    "name": "Nome do cliente",
    "email": "email@exemplo.com",
    "phone": "5511999999999"
  },
  "products": [
    { "name": "Produto X", "price": 99.90, "quantity": 1 }
  ],
  "total": 99.90,
  "checkout_url": "https://sualoja.com/checkout/abc123"
}`}</code>
          </div>
        </CardContent>
      </Card>

      {/* Variáveis */}
      <Card className="glass glow-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Hash className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Variáveis disponíveis</h2>
              <p className="text-xs text-muted-foreground">Use nos templates de e-mail e SMS</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-primary" /> Variáveis de E-mail
              </h3>
              <div className="grid gap-1.5">
                {emailVars.map((v) => (
                  <div key={v.var} className="flex items-center gap-3 p-2 rounded-lg bg-muted/20">
                    <code className="text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded flex-shrink-0">{v.var}</code>
                    <span className="text-xs text-muted-foreground">{v.desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5 text-primary" /> Variáveis de SMS
              </h3>
              <div className="grid gap-1.5">
                {smsVars.map((v) => (
                  <div key={v.var} className="flex items-center gap-3 p-2 rounded-lg bg-muted/20">
                    <code className="text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded flex-shrink-0">{v.var}</code>
                    <span className="text-xs text-muted-foreground">{v.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
