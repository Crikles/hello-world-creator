import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    AlertTriangle,
    Link as LinkIcon,
    CreditCard,
    Eye,
    Settings2,
    Save,
    CheckCircle2,
    ExternalLink,
    DollarSign,
    Clock,
    MessageSquare,
    MousePointerClick,
    Package,
    Truck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { replaceVariables, dadosExemplo } from "./emailTemplates";

/* ─────────────────────── Types ─────────────────────── */

interface TaxacaoSettings {
    mensagem_taxa: string;
    texto_botao: string;
    valor_exemplo: string;
    prazo_dias: string;
    url_pagamento: string;
    forma_pagamento: string;
    cor_botao: string;
    cor_header: string;
    mostrar_valor: boolean;
    mostrar_prazo: boolean;
}

const DEFAULT_SETTINGS: TaxacaoSettings = {
    mensagem_taxa: "Fiscalização aduaneira concluída - aguardando pagamento",
    texto_botao: "PAGUE AGORA",
    valor_exemplo: "0.00",
    prazo_dias: "5",
    url_pagamento: "",
    forma_pagamento: "Todos",
    cor_botao: "#2563eb",
    cor_header: "#f59e0b",
    mostrar_valor: true,
    mostrar_prazo: true,
};

const STORAGE_KEY = "taxacao_config_";

function loadSettings(lojaId: string): TaxacaoSettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY + lojaId);
        if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return { ...DEFAULT_SETTINGS };
}

function saveSettings(lojaId: string, settings: TaxacaoSettings) {
    localStorage.setItem(STORAGE_KEY + lojaId, JSON.stringify(settings));
}

/* ─────────────────────── Email Preview HTML ─────────────────────── */

function buildTaxacaoPreviewHtml(settings: TaxacaoSettings, empresaNome: string, empresaLogoUrl: string): string {
    const valor = parseFloat(settings.valor_exemplo) || 0;
    const valorFormatted = valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const mensagem = replaceVariables(settings.mensagem_taxa);
    const prazoHtml = settings.mostrar_prazo && settings.prazo_dias
        ? `<p style="margin:6px 0 0;font-size:11px;color:#78716c;">Prazo: ${settings.prazo_dias} dias para pagamento</p>`
        : "";



    const logoHtml = empresaLogoUrl
        ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 12px;">
        <tr><td style="width:72px;height:72px;border-radius:50%;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1);">
          <img src="${empresaLogoUrl}" alt="${empresaNome}" width="72" height="72" style="width:72px;height:72px;object-fit:cover;border-radius:50%;display:block;" />
        </td></tr>
       </table>`
        : "";

    const valorHtml = settings.mostrar_valor
        ? `<p style="margin:0 0 2px;font-size:11px;color:#78716c;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Valor da taxa</p>
           <p style="margin:0 0 20px;font-size:32px;font-weight:800;color:#0f172a;letter-spacing:-1px;">R$ ${valorFormatted}</p>`
        : "";

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05),0 8px 32px rgba(0,0,0,0.08);">

        <!-- Logo + Brand -->
        <tr>
          <td style="padding:36px 40px 24px;text-align:center;">
            ${logoHtml}
            <p style="margin:0;color:#64748b;font-size:12px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">${empresaNome}</p>
          </td>
        </tr>

        <!-- Accent bar -->
        <tr>
          <td style="padding:0 40px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:3px;background:linear-gradient(90deg, ${settings.cor_botao}, ${settings.cor_botao}88);border-radius:3px;"></td></tr></table>
          </td>
        </tr>

        <!-- Status Badge + Title -->
        <tr>
          <td style="padding:28px 40px 0;text-align:center;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr><td style="background-color:#fef3c7;color:#92400e;font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;padding:6px 20px;border-radius:20px;">
                ⚠️ Taxa de Importação
              </td></tr>
            </table>
            <p style="margin:16px 0 0;font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;">Pagamento Pendente</p>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:24px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;"><tr><td style="border-top:1px solid #f1f5f9;"></td></tr></table>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">Olá <strong>Maria Silva</strong>,</p>
            <p style="margin:0;font-size:14px;line-height:1.7;color:#475569;">${mensagem}</p>
          </td>
        </tr>

        <!-- Tax Payment Card -->
        <tr>
          <td style="padding:24px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid ${settings.cor_botao};border-radius:16px;overflow:hidden;">
              <tr>
                <td style="background-color:#fffbeb;padding:28px 24px;text-align:center;">
                  ${valorHtml}
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                    <tr><td style="background-color:${settings.cor_botao};border-radius:50px;box-shadow:0 4px 16px ${settings.cor_botao}44;">
                      <a href="#" style="display:inline-block;color:#ffffff;text-decoration:none;padding:14px 48px;font-size:15px;font-weight:800;letter-spacing:0.3px;">${settings.texto_botao}</a>
                    </td></tr>
                  </table>
                  ${prazoHtml}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Order Info -->
        <tr>
          <td style="padding:0 40px 8px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="50%" style="padding-right:6px;vertical-align:top;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:12px;border:1px solid #f1f5f9;">
                    <tr><td style="padding:14px 16px;">
                      <p style="margin:0 0 2px;font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">📦 Produto</p>
                      <p style="margin:0;font-size:13px;font-weight:600;color:#1e293b;">Camiseta Polo Premium</p>
                    </td></tr>
                  </table>
                </td>
                <td width="50%" style="padding-left:6px;vertical-align:top;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:12px;border:1px solid #f1f5f9;">
                    <tr><td style="padding:14px 16px;">
                      <p style="margin:0 0 2px;font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">🚛 Transp.</p>
                      <p style="margin:0;font-size:13px;font-weight:600;color:#1e293b;">JL Transportes</p>
                    </td></tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Tracking Code -->
        <tr>
          <td style="padding:8px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:12px;border:1px solid #f1f5f9;">
              <tr><td style="padding:14px 16px;text-align:center;">
                <p style="margin:0 0 2px;font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">🔍 Rastreio</p>
                <p style="margin:0;font-size:16px;font-weight:800;color:${settings.cor_botao};letter-spacing:1px;font-family:'Courier New',Courier,monospace;">BR547454312HF</p>
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:32px 40px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #f1f5f9;padding-top:20px;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;text-align:center;">Atenciosamente,<br><strong>${empresaNome}</strong></p>
            </td></tr></table>
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td style="padding:16px 0;text-align:center;">
          <p style="margin:0;font-size:11px;color:#cbd5e1;">Enviado por ${empresaNome} • Rastreio automático</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/* ─────────────────────── Tracking Site Preview ─────────────────────── */

function TaxacaoTrackingPreview({ settings, empresaNome, logoUrl }: { settings: TaxacaoSettings; empresaNome: string; logoUrl: string }) {
    const valor = parseFloat(settings.valor_exemplo) || 0;
    const valorFormatted = valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // We use a simplified version of the Rastreio.tsx styles for mobile view
    return (
        <div className="bg-[#f8fafc] rounded-2xl border-2 border-border/50 shadow-xl max-w-[360px] mx-auto overflow-hidden font-sans text-[#0f172a] text-left">
            {/* Nav Mirror */}
            <div className="h-14 bg-white/80 backdrop-blur-md border-b border-black/5 px-4 flex items-center justify-between">
                <img src={logoUrl || "/logojltransportes.png"} alt="Logo" className="h-6 w-auto" />
                <div className="flex flex-col gap-1">
                    <div className="w-5 h-0.5 bg-slate-800 rounded-full" />
                    <div className="w-5 h-0.5 bg-slate-800 rounded-full" />
                </div>
            </div>

            {/* Results Area Mirror (Mobile View) */}
            <div className="p-4 space-y-4">
                {/* Package Label Card (Dark Blue style from Rastreio.tsx) */}
                <div className="bg-[#0f172a] text-white rounded-2xl p-5 shadow-lg relative overflow-hidden">
                    <div className="flex justify-between items-start mb-6">
                        <div className="bg-white/5 py-1 px-2.5 rounded-md flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-[#10b981] rounded-full shadow-[0_0_8px_#10b981]" />
                            <span className="text-[9px] font-extrabold tracking-wider uppercase">Taxação</span>
                        </div>
                        <Package className="w-4 h-4 text-white/40" />
                    </div>

                    <div className="mb-6">
                        <span className="text-[8px] font-bold text-slate-500 tracking-widest block mb-1">IDENTIFIER</span>
                        <div className="font-mono text-xl font-bold tracking-tight">BR847293651XY</div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 mb-4">
                        <div>
                            <span className="text-[8px] font-bold text-slate-500 tracking-widest block mb-0.5 uppercase">Produto</span>
                            <span className="text-xs font-semibold block truncate">Camiseta Polo Premium (x1)</span>
                        </div>
                        <div>
                            <span className="text-[8px] font-bold text-slate-500 tracking-widest block mb-0.5 uppercase">Transportadora</span>
                            <span className="text-xs font-semibold block uppercase">{empresaNome}</span>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-white/5">
                        <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1.5">
                            <span>Progresso da Entrega</span>
                            <span>65%</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-[#6366f1] w-[65%] rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                        </div>
                    </div>
                </div>

                {/* Timeline Area (White card from Rastreio.tsx) */}
                <div className="bg-white rounded-2xl p-5 border border-black/5 shadow-sm">
                    <div className="flex justify-between items-center mb-6 pb-4 border-b border-dashed border-slate-200 text-left">
                        <h3 className="text-[10px] font-extrabold tracking-widest text-[#0f172a] uppercase text-left w-full">Atividade Recente</h3>
                        <div className="flex items-center gap-1 text-[9px] font-semibold text-slate-400 whitespace-nowrap">
                            <Clock size={10} />
                            <span>Sincronizado</span>
                        </div>
                    </div>

                    <div className="relative pl-8 space-y-6">
                        {/* Timeline Line */}
                        <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-100" />

                        {/* Recent Event with Tax Card */}
                        <div className="relative">
                            <div
                                className="absolute -left-[27px] top-0 w-5 h-5 rounded-md flex items-center justify-center z-10 shadow-sm border border-white"
                                style={{ backgroundColor: settings.cor_header }}
                            >
                                <AlertTriangle size={12} className="text-white" />
                            </div>
                            <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm text-left">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-bold" style={{ color: settings.cor_header }}>Aguardando pagamento</span>
                                    <span className="text-[8px] font-black text-[#6366f1] bg-[#6366f1]/10 px-1.5 py-0.5 rounded">ATUAL</span>
                                </div>
                                <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">Fiscalização aduaneira concluída</p>

                                {/* Embedded Tax Card - The one being customized */}
                                <div className="rounded-xl border-2 overflow-hidden" style={{ borderColor: settings.cor_botao }}>
                                    <div className="text-center py-1.5 border-b" style={{ backgroundColor: `${settings.cor_botao}10`, borderColor: `${settings.cor_botao}25` }}>
                                        <p className="text-[9px] font-extrabold" style={{ color: settings.cor_botao }}>⚠ ATENÇÃO - TAXA PENDENTE</p>
                                    </div>
                                    <div className="p-4 text-center bg-white">
                                        <p className="text-[11px] text-[#475569] mb-3 leading-relaxed font-medium">{settings.mensagem_taxa}</p>
                                        {settings.mostrar_valor && (
                                            <div className="mb-3">
                                                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Valor da Taxa</p>
                                                <p className="text-2xl font-black text-[#0f172a]">R$ {valorFormatted}</p>
                                            </div>
                                        )}
                                        <div
                                            className="py-2.5 rounded-lg text-white font-bold text-xs shadow-md transition-transform active:scale-95"
                                            style={{ backgroundColor: settings.cor_botao }}
                                        >
                                            {settings.texto_botao}
                                        </div>
                                        {settings.mostrar_prazo && settings.prazo_dias && (
                                            <p className="text-[10px] text-[#f43f5e] font-bold mt-2.5 flex items-center justify-center gap-1">
                                                <Clock size={10} />
                                                Limite: {settings.prazo_dias} dias
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-50">
                                    <span className="text-[9px] font-extrabold text-slate-400">TAXAÇÃO</span>
                                    <span className="text-[10px] font-semibold text-slate-500">Hoje, 14:20</span>
                                </div>
                            </div>
                        </div>

                        {/* Old Event */}
                        <div className="relative opacity-40">
                            <div className="absolute -left-[27px] top-0.5 w-5 h-5 rounded-md bg-white border-2 border-slate-200 flex items-center justify-center z-10">
                                <Truck size={12} className="text-slate-400" />
                            </div>
                            <div className="bg-slate-50 rounded-xl p-3 text-left">
                                <span className="text-xs font-bold text-slate-700">Em Trânsito</span>
                                <p className="text-[10px] text-slate-500">Curitiba - PR</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-slate-50 border-t border-black/5 px-5 py-3 text-center">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Visualização em tempo real do site de rastreio</p>
            </div>
        </div>
    );
}

/* ─────────────────────── How It Works ─────────────────────── */

function HowItWorks() {
    const steps = [
        { icon: "📦", title: "Envio Criado", desc: "Cliente recebe código de rastreio" },
        { icon: "💲", title: "Taxa Aparece", desc: `Taxa aparece no rastreio após X dias` },
        { icon: "✉️", title: "Cliente Paga", desc: "Cliente paga a taxa e você confirma" },
        { icon: "✅", title: "Envio Liberado", desc: "Após aprovação, rastreio continua" },
    ];

    return (
        <div className="mt-6">
            <p className="text-center text-sm font-semibold mb-4">Como Funciona?</p>
            <div className="grid grid-cols-4 gap-3">
                {steps.map((s, i) => (
                    <div key={i} className="text-center">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-1.5 text-lg">
                            {s.icon}
                        </div>
                        <p className="text-xs font-semibold">{i + 1}. {s.title}</p>
                        <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ─────────────────────── Main Component ─────────────────────── */

interface TaxacaoConfigProps {
    lojaId: string;
    taxacaoAtivo: boolean;
}

export function TaxacaoConfig({ lojaId, taxacaoAtivo }: TaxacaoConfigProps) {
    const [settings, setSettings] = useState<TaxacaoSettings>(() => loadSettings(lojaId));
    const [savedSettings, setSavedSettings] = useState<TaxacaoSettings>(() => loadSettings(lojaId));
    const [previewTab, setPreviewTab] = useState<"email" | "site">("site");
    const queryClient = useQueryClient();

    // Fetch empresa info for preview
    const { data: empresa } = useQuery({
        queryKey: ["empresa-for-taxacao", lojaId],
        queryFn: async () => {
            const { data } = await supabase
                .from("empresas")
                .select("nome_fantasia, razao_social, logo_url")
                .eq("loja_id", lojaId)
                .maybeSingle();
            return data;
        },
        enabled: !!lojaId,
    });

    const empresaNome = empresa?.nome_fantasia || empresa?.razao_social || "Minha Loja";
    const empresaLogoUrl = empresa?.logo_url || "";

    // Fetch active template to find Taxação event and update its corpo_email
    const { data: config } = useQuery({
        queryKey: ["postagem-config", lojaId],
        queryFn: async () => {
            const { data } = await supabase
                .from("postagem_config")
                .select("*")
                .eq("loja_id", lojaId)
                .maybeSingle();
            return data;
        },
        enabled: !!lojaId,
    });

    const { data: taxacaoEvento } = useQuery({
        queryKey: ["taxacao-evento", config?.template_ativo_id],
        queryFn: async () => {
            const { data } = await supabase
                .from("postagem_eventos")
                .select("*")
                .eq("template_id", config!.template_ativo_id!)
                .eq("status_label", "Taxação")
                .maybeSingle();
            return data;
        },
        enabled: !!config?.template_ativo_id,
    });

    const set = (key: keyof TaxacaoSettings, val: any) =>
        setSettings((prev) => ({ ...prev, [key]: val }));

    const hasChanges = useMemo(() => {
        return JSON.stringify(settings) !== JSON.stringify(savedSettings);
    }, [settings, savedSettings]);

    // Save mutation – updates the Taxação event corpo_email + saves to localStorage
    const saveMutation = useMutation({
        mutationFn: async () => {
            // Save to localStorage
            saveSettings(lojaId, settings);

            // Update the Taxação event's corpo_email with the custom message
            if (taxacaoEvento) {
                const corpoEmail = `${settings.mensagem_taxa}\n\n{{taxacao_valor:${settings.valor_exemplo}}}{{taxacao_url:${settings.url_pagamento}}}{{taxacao_botao:${settings.texto_botao}}}{{taxacao_cor:${settings.cor_botao}}}{{taxacao_cor_header:${settings.cor_header}}}{{taxacao_prazo:${settings.prazo_dias}}}{{taxacao_forma:${settings.forma_pagamento}}}{{taxacao_mostrar_valor:${settings.mostrar_valor}}}{{taxacao_mostrar_prazo:${settings.mostrar_prazo}}}`;

                const { error } = await supabase
                    .from("postagem_eventos")
                    .update({
                        corpo_email: corpoEmail,
                    })
                    .eq("id", taxacaoEvento.id);

                if (error) throw error;
            }
        },
        onSuccess: () => {
            setSavedSettings({ ...settings });
            queryClient.invalidateQueries({ queryKey: ["taxacao-evento"] });
            toast({ title: "Configurações de taxação salvas!" });
        },
        onError: () => {
            toast({ title: "Erro ao salvar", variant: "destructive" });
        },
    });

    // Load settings from saved taxacao event on mount
    useEffect(() => {
        if (taxacaoEvento?.corpo_email) {
            const corpo = taxacaoEvento.corpo_email as string;
            try {
                const urlMatch = corpo.match(/\{\{taxacao_url:([^}]*)\}\}/);
                const botaoMatch = corpo.match(/\{\{taxacao_botao:([^}]*)\}\}/);
                const valorMatch = corpo.match(/\{\{taxacao_valor:([^}]*)\}\}/);
                const corMatch = corpo.match(/\{\{taxacao_cor:([^}]*)\}\}/);
                const corHeaderMatch = corpo.match(/\{\{taxacao_cor_header:([^}]*)\}\}/);
                const prazoMatch = corpo.match(/\{\{taxacao_prazo:([^}]*)\}\}/);
                const formaMatch = corpo.match(/\{\{taxacao_forma:([^}]*)\}\}/);
                const mostrarValorMatch = corpo.match(/\{\{taxacao_mostrar_valor:([^}]*)\}\}/);
                const mostrarPrazoMatch = corpo.match(/\{\{taxacao_mostrar_prazo:([^}]*)\}\}/);

                // Extract plain message (before the first {{taxacao_ tag)
                const msgEnd = corpo.indexOf("{{taxacao_");
                const plainMessage = msgEnd > 0 ? corpo.substring(0, msgEnd).trim() : corpo;

                const loaded: TaxacaoSettings = {
                    ...DEFAULT_SETTINGS,
                    mensagem_taxa: plainMessage || DEFAULT_SETTINGS.mensagem_taxa,
                    url_pagamento: urlMatch?.[1] || "",
                    texto_botao: botaoMatch?.[1] || DEFAULT_SETTINGS.texto_botao,
                    valor_exemplo: valorMatch?.[1] || DEFAULT_SETTINGS.valor_exemplo,
                    cor_botao: corMatch?.[1] || DEFAULT_SETTINGS.cor_botao,
                    cor_header: corHeaderMatch?.[1] || DEFAULT_SETTINGS.cor_header,
                    prazo_dias: prazoMatch?.[1] || DEFAULT_SETTINGS.prazo_dias,
                    forma_pagamento: formaMatch?.[1] || DEFAULT_SETTINGS.forma_pagamento,
                    mostrar_valor: mostrarValorMatch ? mostrarValorMatch[1] === "true" : true,
                    mostrar_prazo: mostrarPrazoMatch ? mostrarPrazoMatch[1] === "true" : true,
                };

                setSettings(loaded);
                setSavedSettings(loaded);
                saveSettings(lojaId, loaded);
            } catch { /* use defaults */ }
        }
    }, [taxacaoEvento, lojaId]);

    if (!taxacaoAtivo) {
        return (
            <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
                <CardContent className="py-8 text-center">
                    <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-amber-500" />
                    <p className="font-medium text-amber-800 dark:text-amber-300">Taxação não configurada na Postagens</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        Configure o evento "Taxação" na página de Postagens para ativar.
                    </p>
                </CardContent>
            </Card>
        );
    }

    const emailHtml = buildTaxacaoPreviewHtml(settings, empresaNome, empresaLogoUrl);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        Taxa de Importação
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Configure o pagamento de taxas alfandegárias via link de checkout
                    </p>
                </div>
                {!config?.template_ativo_id && (
                    <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Configure um template de Postagens primeiro
                    </Badge>
                )}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* LEFT COLUMN — Configuration */}
                <div className="space-y-4">
                    {/* Payment Type Toggle */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Settings2 className="h-4 w-4" />
                                Configuração da Taxa
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Informe o link da taxa, junto com a frase e o valor
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-xs text-muted-foreground">
                                O email leva o cliente para uma página de pagamento personalizada com o link do seu checkout.
                            </p>

                            {/* Tax Message */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium flex items-center gap-1">
                                    <MessageSquare className="h-3 w-3" />
                                    Mensagem da Taxa
                                </Label>
                                <Textarea
                                    value={settings.mensagem_taxa}
                                    onChange={(e) => set("mensagem_taxa", e.target.value)}
                                    maxLength={150}
                                    className="text-sm resize-none"
                                    rows={2}
                                />
                                <p className="text-[10px] text-muted-foreground text-right">{settings.mensagem_taxa.length}/150</p>
                            </div>

                            {/* Button text */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium flex items-center gap-1">
                                    <MousePointerClick className="h-3 w-3" />
                                    Mensagem do Botão
                                </Label>
                                <Input
                                    value={settings.texto_botao}
                                    onChange={(e) => set("texto_botao", e.target.value)}
                                    placeholder="PAGUE AGORA"
                                    className="text-sm"
                                />
                            </div>

                            {/* Value and Deadline row */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium flex items-center gap-1">
                                        <DollarSign className="h-3 w-3" />
                                        Valor
                                    </Label>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs text-muted-foreground">R$</span>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={settings.valor_exemplo}
                                            onChange={(e) => set("valor_exemplo", e.target.value)}
                                            className="text-sm"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        Prazo
                                    </Label>
                                    <div className="flex items-center gap-1.5">
                                        <Input
                                            type="number"
                                            min="1"
                                            value={settings.prazo_dias}
                                            onChange={(e) => set("prazo_dias", e.target.value)}
                                            className="text-sm"
                                        />
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">dias</span>
                                    </div>
                                </div>
                            </div>

                            {/* Checkout URL */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium flex items-center gap-1">
                                    <ExternalLink className="h-3 w-3" />
                                    Link de Checkout
                                </Label>
                                <Input
                                    type="url"
                                    value={settings.url_pagamento}
                                    onChange={(e) => set("url_pagamento", e.target.value)}
                                    placeholder="https://seusite.com/checkout"
                                    className="text-sm"
                                />
                                <p className="text-[10px] text-muted-foreground">
                                    Este link será exibido no botão de pagamento da página do cliente
                                </p>
                            </div>



                            {/* Toggles */}
                            <div className="flex items-center justify-between">
                                <Label className="text-xs">Mostrar valor da taxa</Label>
                                <Switch
                                    checked={settings.mostrar_valor}
                                    onCheckedChange={(v) => set("mostrar_valor", v)}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label className="text-xs">Mostrar prazo de pagamento</Label>
                                <Switch
                                    checked={settings.mostrar_prazo}
                                    onCheckedChange={(v) => set("mostrar_prazo", v)}
                                />
                            </div>

                            {/* Colors */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium">Cor do Header</Label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={settings.cor_header}
                                            onChange={(e) => set("cor_header", e.target.value)}
                                            className="w-8 h-8 rounded cursor-pointer border border-border"
                                        />
                                        <Input
                                            value={settings.cor_header}
                                            onChange={(e) => set("cor_header", e.target.value)}
                                            className="text-xs font-mono flex-1"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium">Cor do Botão</Label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={settings.cor_botao}
                                            onChange={(e) => set("cor_botao", e.target.value)}
                                            className="w-8 h-8 rounded cursor-pointer border border-border"
                                        />
                                        <Input
                                            value={settings.cor_botao}
                                            onChange={(e) => set("cor_botao", e.target.value)}
                                            className="text-xs font-mono flex-1"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Save Button */}
                            <Button
                                onClick={() => saveMutation.mutate()}
                                disabled={!hasChanges || saveMutation.isPending}
                                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                                size="lg"
                            >
                                <Save className="h-4 w-4 mr-2" />
                                {saveMutation.isPending ? "Salvando..." : "Atualizar Configurações"}
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* RIGHT COLUMN — Preview */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Eye className="h-4 w-4" />
                                Preview da Taxa
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {/* Preview toggle */}
                            <div className="flex gap-1 p-0.5 bg-muted rounded-lg mb-4">
                                <button
                                    className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${previewTab === "site"
                                        ? "bg-background shadow-sm text-foreground"
                                        : "text-muted-foreground"
                                        }`}
                                    onClick={() => setPreviewTab("site")}
                                >
                                    📱 Site Rastreio
                                </button>
                                <button
                                    className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${previewTab === "email"
                                        ? "bg-background shadow-sm text-foreground"
                                        : "text-muted-foreground"
                                        }`}
                                    onClick={() => setPreviewTab("email")}
                                >
                                    ✉️ Email
                                </button>
                            </div>

                            {previewTab === "site" ? (
                                <TaxacaoTrackingPreview settings={settings} empresaNome={empresaNome} logoUrl={empresaLogoUrl} />
                            ) : (
                                <div className="border rounded-lg overflow-hidden bg-[#f0f0f0]">
                                    <iframe
                                        srcDoc={emailHtml}
                                        title="Email Preview"
                                        style={{ width: "100%", height: 600, border: "none" }}
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Important tips */}
                    <Card className="border-amber-200/50 bg-amber-50/30 dark:bg-amber-950/10">
                        <CardContent className="py-4">
                            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-1">
                                💡 Dicas Importantes
                            </p>
                            <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
                                <li>Use uma mensagem clara e profissional</li>
                                <li>O valor deve estar no formato 0.00</li>
                                <li>Configure um prazo realista</li>
                                <li>Teste o link de pagamento antes de ativar</li>
                            </ul>
                        </CardContent>
                    </Card>

                    <HowItWorks />
                </div>
            </div>
        </div>
    );
}
