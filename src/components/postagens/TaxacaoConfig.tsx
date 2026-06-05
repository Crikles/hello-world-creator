import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
    AlertTriangle,
    CreditCard,
    Eye,
    Save,
    CheckCircle2,
    ExternalLink,
    DollarSign,
    Clock,
    MessageSquare,
    MousePointerClick,
    Lock,
    ShieldCheck,
    QrCode,
    FileText,
    ArrowRight,
    Globe,
    Mail,
    Package,
    Palette,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
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
    cor_destaque: string;
    cor_titulo_resumo: string;
    cor_label_taxa: string;
    cor_descricao: string;
    cor_fundo_descricao: string;
    cor_borda_descricao: string;
    mensagem_site: string;
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
    cor_destaque: "#6366f1",
    cor_titulo_resumo: "#020617",
    cor_label_taxa: "#020617",
    cor_descricao: "#92400e",
    cor_fundo_descricao: "#fffbeb",
    cor_borda_descricao: "#fde68a80",
    mensagem_site: "Sua encomenda foi retida pela fiscalização aduaneira e aguarda a quitação da taxa de liberação. O pagamento é indispensável para que o processo de entrega seja retomado. Efetue o pagamento dentro do prazo para evitar o retorno da mercadoria ao remetente.",
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
           <p style="margin:0 0 20px;font-size:32px;font-weight:800;color:${settings.cor_label_taxa};letter-spacing:-1px;">R$ ${valorFormatted}</p>`
        : "";

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05),0 8px 32px rgba(0,0,0,0.08);">
        <tr><td style="padding:36px 40px 24px;text-align:center;">
            ${logoHtml}
            <p style="margin:0;color:#64748b;font-size:12px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">${empresaNome}</p>
        </td></tr>
        <tr><td style="padding:0 40px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:3px;background:linear-gradient(90deg, ${settings.cor_botao}, ${settings.cor_botao}88);border-radius:3px;"></td></tr></table>
        </td></tr>
        <tr><td style="padding:28px 40px 0;text-align:center;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr><td style="background-color:${settings.cor_fundo_descricao};color:${settings.cor_descricao};font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;padding:6px 20px;border-radius:20px;">
                ⚠️ Taxa de Importação
              </td></tr>
            </table>
            <p style="margin:16px 0 0;font-size:24px;font-weight:800;color:${settings.cor_titulo_resumo};letter-spacing:-0.5px;">Pagamento Pendente</p>
        </td></tr>
        <tr><td style="padding:24px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;"><tr><td style="border-top:1px solid #f1f5f9;"></td></tr></table>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">Olá <strong>Maria Silva</strong>,</p>
            <p style="margin:0;font-size:14px;line-height:1.7;color:#475569;">${mensagem}</p>
        </td></tr>
        <tr><td style="padding:24px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid ${settings.cor_botao};border-radius:16px;overflow:hidden;">
              <tr><td style="background-color:${settings.cor_fundo_descricao};padding:28px 24px;text-align:center;">
                  ${valorHtml}
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                    <tr><td style="background-color:${settings.cor_botao};border-radius:50px;box-shadow:0 4px 16px ${settings.cor_botao}44;">
                      <a href="#" style="display:inline-block;color:#ffffff;text-decoration:none;padding:14px 48px;font-size:15px;font-weight:800;letter-spacing:0.3px;">${settings.texto_botao}</a>
                    </td></tr>
                  </table>
                  ${prazoHtml}
              </td></tr>
            </table>
        </td></tr>
        <tr><td style="padding:0 40px 8px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
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
                      <p style="margin:0;font-size:13px;font-weight:600;color:#1e293b;">ATLAS Transportes</p>
                    </td></tr>
                  </table>
                </td>
            </tr></table>
        </td></tr>
        <tr><td style="padding:8px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:12px;border:1px solid #f1f5f9;">
              <tr><td style="padding:14px 16px;text-align:center;">
                <p style="margin:0 0 2px;font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">🔍 Rastreio</p>
                <p style="margin:0;font-size:16px;font-weight:800;color:${settings.cor_destaque};letter-spacing:1px;font-family:'Courier New',Courier,monospace;">BR547454312HF</p>
              </td></tr>
            </table>
        </td></tr>
        <tr><td style="padding:32px 40px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #f1f5f9;padding-top:20px;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;text-align:center;">Atenciosamente,<br><strong>${empresaNome}</strong></p>
            </td></tr></table>
        </td></tr>
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

    return (
        <div className="bg-[#f8fafc] rounded-2xl border-2 border-border/50 shadow-xl max-w-[360px] mx-auto overflow-hidden text-left" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <div className="bg-white border-b border-black/5 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <img src={logoUrl || "/logojltransportes.png"} alt={empresaNome} className="h-9 w-9 rounded-full object-cover" />
                    <div className="flex flex-col">
                        <span className="text-[11px] font-extrabold text-[#020617]">{empresaNome}</span>
                        <span className="text-[8px] font-extrabold text-[#10b981] flex items-center gap-1">
                            <Lock size={8} /> PAGAMENTO SEGURO
                        </span>
                    </div>
                </div>
                <span className="text-[9px] text-slate-400 font-semibold">← Voltar</span>
            </div>

            <div className="flex justify-center gap-3 py-3 px-3 bg-white border-b border-black/5">
                <div className="flex items-center gap-1 text-[8px] font-extrabold uppercase tracking-wider text-[#10b981]">
                    <CheckCircle2 size={10} /> Pedido
                </div>
                <div className="flex items-center gap-1 text-[8px] font-extrabold uppercase tracking-wider" style={{ color: settings.cor_destaque }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: settings.cor_destaque }} /> Taxação
                </div>
                <div className="text-[8px] font-extrabold uppercase tracking-wider text-slate-300">Liberação</div>
                <div className="text-[8px] font-extrabold uppercase tracking-wider text-slate-300">Entrega</div>
            </div>

            <div className="p-3 space-y-3">
                <div className="bg-white rounded-2xl border border-black/5 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-dashed border-slate-200">
                        <FileText size={14} className="text-slate-600" />
                        <h3 className="text-[10px] font-extrabold tracking-wide uppercase" style={{ color: settings.cor_titulo_resumo }}>Resumo da Cobrança</h3>
                    </div>
                    <div className="space-y-2 text-[10px]">
                        <div className="flex justify-between"><span className="font-bold text-slate-500 uppercase">Cliente</span><span className="font-bold text-[#020617]">Maria Silva</span></div>
                        <div className="flex justify-between"><span className="font-bold text-slate-500 uppercase">CPF</span><span className="font-mono text-[10px] font-semibold" style={{ color: settings.cor_destaque }}>123.456.789-00</span></div>
                        <div className="flex justify-between items-start"><span className="font-bold text-slate-500 uppercase">Endereço</span><span className="font-bold text-[#020617] text-right text-[9px] max-w-[55%]">Rua Exemplo, 123 - Centro<br />São Paulo/SP — CEP 01000-000</span></div>
                        <div className="h-px bg-slate-100 my-1" />
                        <div className="flex justify-between"><span className="font-bold text-slate-500 uppercase">Produto</span><span className="font-bold text-[#020617]">Camiseta Polo Premium</span></div>
                        <div className="flex justify-between"><span className="font-bold text-slate-500 uppercase">Referência</span><span className="font-mono text-[10px] font-semibold" style={{ color: settings.cor_destaque }}>BR547454312HF</span></div>
                        <div className="flex justify-between"><span className="font-bold text-slate-500 uppercase">Transportadora</span><span className="font-bold text-[#020617]">ATLAS Transportes</span></div>
                        <div className="h-px bg-slate-100 my-1" />
                        {settings.mostrar_valor && (
                            <div className="flex justify-between items-baseline">
                                <span className="text-[11px] font-extrabold uppercase" style={{ color: settings.cor_label_taxa }}>Total a pagar</span>
                                <div className="flex items-baseline gap-0.5">
                                    <span className="text-[9px] font-bold text-slate-500">R$</span>
                                    <span className="text-lg font-extrabold" style={{ color: settings.cor_label_taxa }}>{valorFormatted}</span>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="mt-3 p-2.5 rounded-xl" style={{ backgroundColor: settings.cor_fundo_descricao, borderWidth: 1, borderStyle: 'solid', borderColor: settings.cor_borda_descricao }}>
                        <p className="text-[9px] leading-relaxed font-medium" style={{ color: settings.cor_descricao }}>{settings.mensagem_site}</p>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-black/5 p-4 shadow-sm">
                    <div className="text-center mb-3">
                        <span className="text-[8px] font-extrabold tracking-widest uppercase px-2 py-0.5 rounded-full" style={{ color: settings.cor_destaque, backgroundColor: `${settings.cor_destaque}1a` }}>AÇÃO REQUERIDA</span>
                        <h2 className="text-sm font-extrabold text-[#020617] mt-2">Efetuar Pagamento</h2>
                        <p className="text-[9px] text-slate-500 mt-1">Selecione o método de pagamento para liberar sua encomenda.</p>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-xl border-2 mb-3" style={{ borderColor: settings.cor_destaque, backgroundColor: `${settings.cor_destaque}0d` }}>
                        <QrCode size={14} style={{ color: settings.cor_destaque }} />
                        <span className="text-[10px] font-bold text-[#020617]">PIX</span>
                        <CheckCircle2 size={12} className="ml-auto" style={{ color: settings.cor_destaque }} />
                    </div>
                    <div className="w-full py-2.5 rounded-xl text-white font-bold text-xs text-center flex items-center justify-center gap-1.5 shadow-md" style={{ backgroundColor: settings.cor_botao }}>
                        <span>{settings.texto_botao}</span>
                        <ArrowRight size={12} />
                    </div>
                    {settings.mostrar_prazo && settings.prazo_dias && (
                        <div className="flex items-center justify-center gap-1 mt-2.5 text-[9px] text-slate-500 font-semibold">
                            <Clock size={10} />
                            <span>Prazo limite: <strong className="text-[#020617]">{settings.prazo_dias} dias</strong></span>
                        </div>
                    )}
                </div>

                <div className="flex justify-center gap-3 py-2">
                    <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400"><Lock size={9} /> SSL SECURE</div>
                    <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400"><CreditCard size={9} /> ENCRYPTED</div>
                    <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400"><ShieldCheck size={9} /> VERIFIED</div>
                </div>
            </div>

            <div className="bg-slate-50 border-t border-black/5 px-5 py-2.5 text-center">
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Preview da página de pagamento real</p>
            </div>
        </div>
    );
}

/* ─────────────────────── How It Works ─────────────────────── */

function HowItWorks() {
    const steps = [
        { icon: Package, title: "Envio Criado", desc: "Cliente recebe código de rastreio" },
        { icon: DollarSign, title: "Taxa Aparece", desc: "Taxa aparece no rastreio após X dias" },
        { icon: CreditCard, title: "Cliente Paga", desc: "Cliente paga a taxa e você confirma" },
        { icon: CheckCircle2, title: "Envio Liberado", desc: "Após aprovação, rastreio continua" },
    ];

    return (
        <div className="glass glow-border rounded-xl p-5 animate-stagger-in" style={{ animationDelay: "0.2s" }}>
            <p className="text-sm font-semibold text-foreground mb-4 text-center">Como Funciona?</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {steps.map((s, i) => (
                    <div key={i} className="text-center animate-stagger-in" style={{ animationDelay: `${0.3 + i * 0.08}s` }}>
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                            <s.icon className="h-4.5 w-4.5 text-primary" />
                        </div>
                        <p className="text-xs font-semibold text-foreground">{i + 1}. {s.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{s.desc}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ─────────────────────── Color Picker Helper ─────────────────────── */

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
                .eq("nome", "Taxação")
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
    const emailHtml = useMemo(
        () => buildTaxacaoPreviewHtml(settings, empresaNome, empresaLogoUrl),
        [settings, empresaNome, empresaLogoUrl]
    );
    const debouncedEmailHtml = useDebouncedValue(emailHtml, 300);

    const saveMutation = useMutation({
        mutationFn: async () => {
            saveSettings(lojaId, settings);
            if (taxacaoEvento) {
                const corpoEmail = `${settings.mensagem_taxa}\n\n{{taxacao_valor:${settings.valor_exemplo}}}{{taxacao_url:${settings.url_pagamento}}}{{taxacao_botao:${settings.texto_botao}}}{{taxacao_cor:${settings.cor_botao}}}{{taxacao_cor_header:${settings.cor_header}}}{{taxacao_cor_destaque:${settings.cor_destaque}}}{{taxacao_prazo:${settings.prazo_dias}}}{{taxacao_forma:${settings.forma_pagamento}}}{{taxacao_mostrar_valor:${settings.mostrar_valor}}}{{taxacao_mostrar_prazo:${settings.mostrar_prazo}}}{{taxacao_cor_titulo_resumo:${settings.cor_titulo_resumo}}}{{taxacao_cor_label_taxa:${settings.cor_label_taxa}}}{{taxacao_cor_descricao:${settings.cor_descricao}}}{{taxacao_cor_fundo_descricao:${settings.cor_fundo_descricao}}}{{taxacao_cor_borda_descricao:${settings.cor_borda_descricao}}}{{taxacao_mensagem_site:${settings.mensagem_site}}}`;
                const { error } = await supabase
                    .from("postagem_eventos")
                    .update({ corpo_email: corpoEmail })
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

    useEffect(() => {
        if (taxacaoEvento?.corpo_email) {
            const corpo = taxacaoEvento.corpo_email as string;
            try {
                const urlMatch = corpo.match(/\{\{taxacao_url:([^}]*)\}\}/);
                const botaoMatch = corpo.match(/\{\{taxacao_botao:([^}]*)\}\}/);
                const valorMatch = corpo.match(/\{\{taxacao_valor:([^}]*)\}\}/);
                const corMatch = corpo.match(/\{\{taxacao_cor:([^}]*)\}\}/);
                const corHeaderMatch = corpo.match(/\{\{taxacao_cor_header:([^}]*)\}\}/);
                const corDestaqueMatch = corpo.match(/\{\{taxacao_cor_destaque:([^}]*)\}\}/);
                const prazoMatch = corpo.match(/\{\{taxacao_prazo:([^}]*)\}\}/);
                const formaMatch = corpo.match(/\{\{taxacao_forma:([^}]*)\}\}/);
                const mostrarValorMatch = corpo.match(/\{\{taxacao_mostrar_valor:([^}]*)\}\}/);
                const mostrarPrazoMatch = corpo.match(/\{\{taxacao_mostrar_prazo:([^}]*)\}\}/);
                const corTituloResumoMatch = corpo.match(/\{\{taxacao_cor_titulo_resumo:([^}]*)\}\}/);
                const corLabelTaxaMatch = corpo.match(/\{\{taxacao_cor_label_taxa:([^}]*)\}\}/);
                const corDescricaoMatch = corpo.match(/\{\{taxacao_cor_descricao:([^}]*)\}\}/);
                const corFundoDescricaoMatch = corpo.match(/\{\{taxacao_cor_fundo_descricao:([^}]*)\}\}/);
                const corBordaDescricaoMatch = corpo.match(/\{\{taxacao_cor_borda_descricao:([^}]*)\}\}/);
                const mensagemSiteMatch = corpo.match(/\{\{taxacao_mensagem_site:([^}]*)\}\}/);

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
                    cor_destaque: corDestaqueMatch?.[1] || DEFAULT_SETTINGS.cor_destaque,
                    prazo_dias: prazoMatch?.[1] || DEFAULT_SETTINGS.prazo_dias,
                    forma_pagamento: formaMatch?.[1] || DEFAULT_SETTINGS.forma_pagamento,
                    mostrar_valor: mostrarValorMatch ? mostrarValorMatch[1] === "true" : true,
                    mostrar_prazo: mostrarPrazoMatch ? mostrarPrazoMatch[1] === "true" : true,
                    cor_titulo_resumo: corTituloResumoMatch?.[1] || DEFAULT_SETTINGS.cor_titulo_resumo,
                    cor_label_taxa: corLabelTaxaMatch?.[1] || DEFAULT_SETTINGS.cor_label_taxa,
                    cor_descricao: corDescricaoMatch?.[1] || DEFAULT_SETTINGS.cor_descricao,
                    cor_fundo_descricao: corFundoDescricaoMatch?.[1] || DEFAULT_SETTINGS.cor_fundo_descricao,
                    cor_borda_descricao: corBordaDescricaoMatch?.[1] || DEFAULT_SETTINGS.cor_borda_descricao,
                    mensagem_site: mensagemSiteMatch?.[1] || DEFAULT_SETTINGS.mensagem_site,
                };

                setSettings(loaded);
                setSavedSettings(loaded);
                saveSettings(lojaId, loaded);
            } catch { /* use defaults */ }
        }
    }, [taxacaoEvento, lojaId]);

    if (!taxacaoAtivo) {
        return (
            <div className="glass glow-border rounded-xl flex flex-col items-center justify-center py-16 text-center">
                <div className="relative mb-4">
                    <div className="h-16 w-16 rounded-full bg-primary/5 flex items-center justify-center">
                        <AlertTriangle className="h-8 w-8 text-primary/30" />
                    </div>
                    <div className="absolute inset-0 animate-orbit">
                        <div className="h-2 w-2 rounded-full bg-primary/30 animate-pulse-dot" />
                    </div>
                </div>
                <p className="text-foreground font-medium">Taxação não configurada</p>
                <p className="text-xs text-muted-foreground mt-1">
                    Ative o "Funil de Taxação" na aba Configuração para começar.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <AlertTriangle className="h-4 w-4 text-primary" />
                        </div>
                        Taxa de Importação
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                        Configure o pagamento de taxas alfandegárias via link de checkout
                    </p>
                </div>
                {!config?.template_ativo_id && (
                    <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 text-[10px]">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Configure um template primeiro
                    </Badge>
                )}
            </div>

            <div className="grid lg:grid-cols-2 gap-5">
                {/* LEFT — Configuration */}
                <div className="space-y-4">
                    {/* Site Settings */}
                    <div className="glass glow-border rounded-xl p-5 animate-stagger-in" style={{ animationDelay: "0s" }}>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Globe className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-foreground">Site de Pagamento</p>
                                <p className="text-[10px] text-muted-foreground">Personalize a página que o cliente acessa</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
                                    <MousePointerClick className="h-3 w-3" /> Mensagem do Botão
                                </Label>
                                <Input value={settings.texto_botao} onChange={(e) => set("texto_botao", e.target.value)} placeholder="PAGUE AGORA" className="text-sm bg-transparent border-border/50" />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
                                        <DollarSign className="h-3 w-3" /> Valor
                                    </Label>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs text-muted-foreground">R$</span>
                                        <Input type="number" step="0.01" min="0" value={settings.valor_exemplo} onChange={(e) => set("valor_exemplo", e.target.value)} className="text-sm bg-transparent border-border/50" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
                                        <Clock className="h-3 w-3" /> Prazo
                                    </Label>
                                    <div className="flex items-center gap-1.5">
                                        <Input type="number" min="1" value={settings.prazo_dias} onChange={(e) => set("prazo_dias", e.target.value)} className="text-sm bg-transparent border-border/50" />
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">dias</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
                                    <ExternalLink className="h-3 w-3" /> Link de Checkout
                                </Label>
                                <Input type="url" value={settings.url_pagamento} onChange={(e) => set("url_pagamento", e.target.value)} placeholder="https://seusite.com/checkout" className="text-sm bg-transparent border-border/50" />
                                <p className="text-[10px] text-muted-foreground">Link exibido no botão de pagamento da página</p>
                            </div>

                            <div className="flex items-center justify-between py-1">
                                <Label className="text-xs text-muted-foreground">Mostrar valor da taxa</Label>
                                <Switch checked={settings.mostrar_valor} onCheckedChange={(v) => set("mostrar_valor", v)} />
                            </div>
                            <div className="flex items-center justify-between py-1">
                                <Label className="text-xs text-muted-foreground">Mostrar prazo de pagamento</Label>
                                <Switch checked={settings.mostrar_prazo} onCheckedChange={(v) => set("mostrar_prazo", v)} />
                            </div>
                        </div>
                    </div>

                    {/* Mensagem do Site */}
                    <div className="glass glow-border rounded-xl p-5 animate-stagger-in" style={{ animationDelay: "0.05s" }}>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                                <MessageSquare className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-foreground">Mensagem do Site</p>
                                <p className="text-[10px] text-muted-foreground">Texto exibido no box de descrição da página</p>
                            </div>
                        </div>
                        <Textarea
                            value={settings.mensagem_site}
                            onChange={(e) => set("mensagem_site", e.target.value)}
                            maxLength={500}
                            className="text-sm resize-none bg-transparent border-border/50"
                            rows={4}
                        />
                        <p className="text-[10px] text-muted-foreground text-right mt-1">{settings.mensagem_site.length}/500</p>
                    </div>

                    {/* Personalização de Cores */}
                    <div className="glass glow-border rounded-xl p-5 animate-stagger-in" style={{ animationDelay: "0.06s" }}>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Palette className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-foreground">Personalização de Cores</p>
                                <p className="text-[10px] text-muted-foreground">Customize cada elemento visual</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <ColorPicker label="Cor do Botão" value={settings.cor_botao} onChange={(v) => set("cor_botao", v)} />
                            <ColorPicker label="Cor de Destaque" value={settings.cor_destaque} onChange={(v) => set("cor_destaque", v)} />
                            <ColorPicker label="Título (Resumo)" value={settings.cor_titulo_resumo} onChange={(v) => set("cor_titulo_resumo", v)} />
                            <ColorPicker label="Label (Total)" value={settings.cor_label_taxa} onChange={(v) => set("cor_label_taxa", v)} />
                            <ColorPicker label="Texto Descrição" value={settings.cor_descricao} onChange={(v) => set("cor_descricao", v)} />
                            <ColorPicker label="Fundo Descrição" value={settings.cor_fundo_descricao} onChange={(v) => set("cor_fundo_descricao", v)} />
                            <ColorPicker label="Borda Descrição" value={settings.cor_borda_descricao} onChange={(v) => set("cor_borda_descricao", v)} />
                        </div>
                    </div>

                    {/* Email Message */}
                    <div className="glass glow-border rounded-xl p-5 animate-stagger-in" style={{ animationDelay: "0.08s" }}>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Mail className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-foreground">Mensagem do Email</p>
                                <p className="text-[10px] text-muted-foreground">Aparece <strong>apenas no email</strong>, não no site</p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
                                <MessageSquare className="h-3 w-3" /> Mensagem da Taxa
                            </Label>
                            <Textarea
                                value={settings.mensagem_taxa}
                                onChange={(e) => set("mensagem_taxa", e.target.value)}
                                maxLength={150}
                                className="text-sm resize-none bg-transparent border-border/50"
                                rows={2}
                            />
                            <p className="text-[10px] text-muted-foreground text-right">{settings.mensagem_taxa.length}/150</p>
                        </div>
                        <div className="p-2.5 bg-primary/5 border border-primary/10 rounded-lg mt-2">
                            <p className="text-[10px] text-primary font-medium">
                                💡 O site de pagamento usa a mensagem configurada acima. Esta mensagem personalizada aparece somente no corpo do email.
                            </p>
                        </div>
                    </div>

                    {/* Save Button */}
                    <Button
                        onClick={() => saveMutation.mutate()}
                        disabled={!hasChanges || saveMutation.isPending}
                        className="w-full shimmer-btn"
                        size="lg"
                    >
                        <Save className="h-4 w-4 mr-2" />
                        {saveMutation.isPending ? "Salvando..." : "Atualizar Configurações"}
                    </Button>
                </div>

                {/* RIGHT — Preview + How It Works */}
                <div className="space-y-4">
                    <div className="glass glow-border rounded-xl p-5 animate-stagger-in" style={{ animationDelay: "0.1s" }}>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Eye className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <p className="text-sm font-semibold text-foreground">Preview da Taxa</p>
                        </div>

                        {/* Preview toggle */}
                        <div className="flex gap-1 p-0.5 glass rounded-lg mb-4">
                            <button
                                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${previewTab === "site" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
                                onClick={() => setPreviewTab("site")}
                            >
                                📱 Site Pagamento
                            </button>
                            <button
                                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${previewTab === "email" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
                                onClick={() => setPreviewTab("email")}
                            >
                                ✉️ Email
                            </button>
                        </div>

                        {previewTab === "site" ? (
                            <TaxacaoTrackingPreview settings={settings} empresaNome={empresaNome} logoUrl={empresaLogoUrl} />
                        ) : (
                            <div className="border border-border/30 rounded-lg overflow-hidden">
                                <iframe srcDoc={debouncedEmailHtml} title="Email Preview" style={{ width: "100%", height: 600, border: "none" }} />
                            </div>
                        )}
                    </div>

                    <HowItWorks />
                </div>
            </div>
        </div>
    );
}
