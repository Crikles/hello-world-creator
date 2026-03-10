import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
    PackageX,
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
    CreditCard,
    FileText,
    ArrowRight,
    Globe,
    Mail,
    AlertTriangle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

/* ─────────────────────── Types ─────────────────────── */

interface FalhaEntregaSettings {
    msg_falha_entrega: string;
    checkout_url_falha: string;
    valor_taxa_falha: string;
    cor_botao: string;
    cor_destaque: string;
}

const DEFAULT_SETTINGS: FalhaEntregaSettings = {
    msg_falha_entrega: "Houve uma falha na tentativa de entrega do seu pedido. Para reenviarmos, por favor pague a taxa de retentativa.",
    checkout_url_falha: "",
    valor_taxa_falha: "0.00",
    cor_botao: "#ea580c",
    cor_destaque: "#ea580c",
};

const STORAGE_KEY = "falha_entrega_config_";

function loadSettings(lojaId: string): FalhaEntregaSettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY + lojaId);
        if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return { ...DEFAULT_SETTINGS };
}

function saveSettings(lojaId: string, settings: FalhaEntregaSettings) {
    localStorage.setItem(STORAGE_KEY + lojaId, JSON.stringify(settings));
}

/* ─────────────────────── Fixed message ─────────────────────── */

const MENSAGEM_FIXA_SITE = "A transportadora não conseguiu concluir a entrega do seu pedido. O pacote retornou ao nosso centro de distribuição. Para realizarmos uma nova tentativa de envio, é necessário o pagamento da taxa de reenvio.";

/* ─────────────────────── Tracking Site Preview ─────────────────────── */

function FalhaEntregaTrackingPreview({ settings, empresaNome, logoUrl }: { settings: FalhaEntregaSettings; empresaNome: string; logoUrl: string }) {
    const valor = parseFloat(settings.valor_taxa_falha) || 0;
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
                    <PackageX size={10} /> Falha na Entrega
                </div>
                <div className="text-[8px] font-extrabold uppercase tracking-wider text-slate-300">Retentativa</div>
            </div>

            <div className="p-3 space-y-3">
                <div className="bg-white rounded-2xl border border-black/5 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-dashed border-slate-200">
                        <FileText size={14} className="text-slate-600" />
                        <h3 className="text-[10px] font-extrabold tracking-wide uppercase">Resumo do Reenvio</h3>
                    </div>
                    <div className="space-y-2 text-[10px]">
                        <div className="flex justify-between"><span className="font-bold text-slate-500 uppercase">Cliente</span><span className="font-bold text-[#020617]">Maria Silva</span></div>
                        <div className="h-px bg-slate-100 my-1" />
                        <div className="flex justify-between"><span className="font-bold text-slate-500 uppercase">Produto</span><span className="font-bold text-[#020617]">Camiseta Polo Premium</span></div>
                        <div className="flex justify-between"><span className="font-bold text-slate-500 uppercase">Referência</span><span className="font-mono text-[10px] font-semibold" style={{ color: settings.cor_destaque }}>BR547454312HF</span></div>
                        <div className="flex justify-between"><span className="font-bold text-slate-500 uppercase">Status</span><span className="font-bold" style={{ color: settings.cor_destaque }}>Tentativa Frustrada</span></div>
                        <div className="h-px bg-slate-100 my-1" />
                        <div className="flex justify-between items-baseline">
                            <span className="text-[11px] font-extrabold uppercase">Taxa de Reenvio</span>
                            <div className="flex items-baseline gap-0.5">
                                <span className="text-[9px] font-bold text-slate-500">R$</span>
                                <span className="text-lg font-extrabold text-[#020617]">{valorFormatted}</span>
                            </div>
                        </div>
                    </div>
                    <div className="mt-3 p-2.5 bg-orange-50 border border-orange-200/50 rounded-xl">
                        <p className="text-[9px] text-orange-900 leading-relaxed font-medium">{MENSAGEM_FIXA_SITE}</p>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-black/5 p-4 shadow-sm">
                    <div className="text-center mb-3">
                        <span className="text-[8px] font-extrabold tracking-widest uppercase px-2 py-0.5 rounded-full" style={{ color: settings.cor_destaque, backgroundColor: `${settings.cor_destaque}1a` }}>AÇÃO REQUERIDA</span>
                        <h2 className="text-sm font-extrabold text-[#020617] mt-2">Pagar Novo Frete</h2>
                        <p className="text-[9px] text-slate-500 mt-1">Realize o pagamento para reenviarmos seu pedido.</p>
                    </div>

                    <div className="w-full py-2.5 rounded-xl text-white font-bold text-xs text-center flex items-center justify-center gap-1.5 shadow-md" style={{ backgroundColor: settings.cor_botao }}>
                        <span>PAGAR REENVIO</span>
                        <ArrowRight size={12} />
                    </div>
                </div>
            </div>

            <div className="bg-slate-50 border-t border-black/5 px-5 py-2.5 text-center">
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Preview da página de pagamento (Rastreio)</p>
            </div>
        </div>
    );
}


/* ─────────────────────── Email Preview ─────────────────────── */

function FalhaEntregaEmailPreview({ settings, empresaNome }: { settings: FalhaEntregaSettings; empresaNome: string }) {
    const valor = parseFloat(settings.valor_taxa_falha) || 0;
    const valorFormatted = valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const htmlContent = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:20px;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
        <tr><td style="padding:40px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td width="48"><div style="width:48px;height:48px;background-color:#fff7ed;border-radius:16px;text-align:center;line-height:48px;font-size:24px;">📦</div></td>
              <td style="padding-left:16px;">
                <h1 style="margin:0;font-size:20px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;">Falha na Entrega</h1>
                <p style="margin:4px 0 0;font-size:14px;color:${settings.cor_destaque};font-weight:600;">Ação Necessária</p>
              </td>
            </tr></table>
        </td></tr>
        <tr><td style="padding:32px 40px;">
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">Olá <strong>Maria Silva</strong>,</p>
            <p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">Tivemos um problema ao entregar o seu pedido <strong style="color:#0f172a;">Camiseta Polo Premium</strong>.</p>
        </td></tr>
        <tr><td style="padding:0 40px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff7ed;border-radius:16px;border:1px solid #ffedd5;">
              <tr><td style="padding:24px;">
                <p style="margin:0 0 16px;font-size:15px;color:#c2410c;line-height:1.6;font-weight:500;">
                  ${settings.msg_falha_entrega}
                </p>
                <div style="background-color:#ffffff;border-radius:12px;padding:16px;margin:16px 0;border:1px solid #ffedd5;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td><p style="margin:0;font-size:13px;color:#64748b;font-weight:600;text-transform:uppercase;">Taxa de Reenvio</p></td>
                      <td align="right"><p style="margin:0;font-size:20px;color:#0f172a;font-weight:800;">R$ ${valorFormatted}</p></td>
                    </tr>
                  </table>
                </div>
                <div style="text-align:center;margin-top:24px;">
                  <span style="display:inline-block;padding:14px 32px;background-color:${settings.cor_botao};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;border-radius:12px;">PAGAR REENVIO AGORA</span>
                </div>
              </td></tr>
            </table>
        </td></tr>
        <tr><td style="padding:8px 40px 32px;">
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

    return (
        <div className="bg-[#f1f5f9] rounded-2xl border-2 border-border/50 shadow-xl overflow-hidden w-full h-[500px] flex flex-col">
            {/* Header for Email Window */}
            <div className="bg-white border-b border-black/5 px-4 py-3 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-400" />
                        <div className="w-3 h-3 rounded-full bg-amber-400" />
                        <div className="w-3 h-3 rounded-full bg-green-400" />
                    </div>
                    <div className="flex flex-col ml-2">
                        <span className="text-[11px] font-bold text-slate-700">Nova Mensagem</span>
                        <span className="text-[9px] text-slate-400 flex items-center gap-1">
                            Para: Maria Silva
                        </span>
                    </div>
                </div>
            </div>

            {/* Scale Container */}
            <div className="flex-1 relative overflow-auto custom-scrollbar bg-slate-100/50 flex">
                <div className="absolute inset-0 origin-top flex items-start justify-center p-4">
                    <div className="w-full max-w-[600px] shadow-sm transform scale-90 sm:scale-100 origin-top">
                        <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
                    </div>
                </div>
            </div>
            <div className="bg-slate-50 border-t border-black/5 px-5 py-2.5 text-center mt-auto z-10">
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Preview visual do E-mail</p>
            </div>
        </div>
    );
}



/* ─────────────────────── Main Component ─────────────────────── */

interface FalhaEntregaConfigProps {
    lojaId: string;
    falhaEntregaAtivo: boolean;
}

export function FalhaEntregaConfig({ lojaId, falhaEntregaAtivo }: FalhaEntregaConfigProps) {
    const [settings, setSettings] = useState<FalhaEntregaSettings>(() => loadSettings(lojaId));
    const [savedSettings, setSavedSettings] = useState<FalhaEntregaSettings>(() => loadSettings(lojaId));
    const [previewTab, setPreviewTab] = useState<"site" | "email">("site");
    const queryClient = useQueryClient();

    const { data: empresa } = useQuery({
        queryKey: ["empresa-for-falha-entrega", lojaId],
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

    const set = (key: keyof FalhaEntregaSettings, val: any) =>
        setSettings((prev) => ({ ...prev, [key]: val }));

    const hasChanges = useMemo(() => {
        return JSON.stringify(settings) !== JSON.stringify(savedSettings);
    }, [settings, savedSettings]);

    const saveMutation = useMutation({
        mutationFn: async () => {
            saveSettings(lojaId, settings);
            const { error } = await supabase
                .from("postagem_config")
                .update({
                    msg_falha_entrega: settings.msg_falha_entrega,
                    checkout_url_falha: settings.checkout_url_falha,
                    valor_taxa_falha: parseFloat(settings.valor_taxa_falha) || 0
                })
                .eq("loja_id", lojaId);
            if (error) throw error;
        },
        onSuccess: () => {
            setSavedSettings({ ...settings });
            queryClient.invalidateQueries({ queryKey: ["postagem-config"] });
            toast({ title: "Configurações de Falha na Entrega salvas!" });
        },
        onError: () => {
            toast({ title: "Erro ao salvar", variant: "destructive" });
        },
    });

    useEffect(() => {
        if (config) {
            const loaded: FalhaEntregaSettings = {
                msg_falha_entrega: (config as any).msg_falha_entrega || DEFAULT_SETTINGS.msg_falha_entrega,
                checkout_url_falha: (config as any).checkout_url_falha || "",
                valor_taxa_falha: ((config as any).valor_taxa_falha || 0).toString(),
                cor_botao: DEFAULT_SETTINGS.cor_botao,
                cor_destaque: DEFAULT_SETTINGS.cor_destaque,
            };
            setSettings(loaded);
            setSavedSettings(loaded);
            saveSettings(lojaId, loaded);
        }
    }, [config, lojaId]);

    if (!falhaEntregaAtivo) {
        return (
            <div className="glass glow-border rounded-xl flex flex-col items-center justify-center py-16 text-center">
                <div className="relative mb-4">
                    <div className="h-16 w-16 rounded-full bg-orange-500/10 flex items-center justify-center">
                        <PackageX className="h-8 w-8 text-orange-500" />
                    </div>
                    <div className="absolute inset-0 animate-orbit">
                        <div className="h-2 w-2 rounded-full bg-orange-500/30 animate-pulse-dot" />
                    </div>
                </div>
                <p className="text-foreground font-medium">Falha na Entrega Desativada</p>
                <p className="text-xs text-muted-foreground mt-1">
                    Ative a "Falha na Entrega" na aba Configuração para usar este funil automático.
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
                        <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                            <PackageX className="h-4 w-4 text-orange-500" />
                        </div>
                        Falha na Entrega (Retentativa)
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                        Configure a cobrança automática de frete quando houver falha na entrega
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
                                <p className="text-sm font-semibold text-foreground">Pagamento do Reenvio</p>
                                <p className="text-[10px] text-muted-foreground">Personalize a cobrança</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
                                    <DollarSign className="h-3 w-3" /> Valor do Frete
                                </Label>
                                <div className="flex items-center gap-1.5 w-1/2">
                                    <span className="text-xs text-muted-foreground">R$</span>
                                    <Input type="number" step="0.01" min="0" value={settings.valor_taxa_falha} onChange={(e) => set("valor_taxa_falha", String(e.target.value))} className="text-sm bg-transparent border-border/50" />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
                                    <ExternalLink className="h-3 w-3" /> Link de Checkout
                                </Label>
                                <Input type="url" value={settings.checkout_url_falha} onChange={(e) => set("checkout_url_falha", e.target.value)} placeholder="https://seusite.com/checkout-frete" className="text-sm bg-transparent border-border/50" />
                                <p className="text-[10px] text-muted-foreground">Link exibido no botão para o cliente pagar a retentativa</p>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground">Cor do Botão</Label>
                                <div className="flex items-center gap-2">
                                    <input type="color" value={settings.cor_botao} onChange={(e) => set("cor_botao", e.target.value)} className="w-8 h-8 rounded cursor-pointer border border-border/50" />
                                    <Input value={settings.cor_botao} onChange={(e) => set("cor_botao", e.target.value)} className="text-xs font-mono flex-1 bg-transparent border-border/50" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Email Message */}
                    <div className="glass glow-border rounded-xl p-5 animate-stagger-in" style={{ animationDelay: "0.08s" }}>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Mail className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-foreground">Mensagem do Aviso</p>
                                <p className="text-[10px] text-muted-foreground">O que o cliente vai ler no Email/SMS</p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
                                <MessageSquare className="h-3 w-3" /> Texto Personalizado
                            </Label>
                            <Textarea
                                value={settings.msg_falha_entrega}
                                onChange={(e) => set("msg_falha_entrega", e.target.value)}
                                maxLength={250}
                                className="text-sm resize-none bg-transparent border-border/50"
                                rows={3}
                            />
                            <p className="text-[10px] text-muted-foreground text-right">{settings.msg_falha_entrega.length}/250</p>
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
                        {saveMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                    </Button>
                </div>

                {/* RIGHT — Previews */}
                <div className="space-y-4">
                    <div className="glass glow-border rounded-xl p-5 animate-stagger-in flex flex-col" style={{ animationDelay: "0.1s" }}>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Eye className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <p className="text-sm font-semibold text-foreground">Pré-visualização</p>
                        </div>

                        <div className="flex-1 w-full flex flex-col">
                            {/* Visualizar as 3 abas */}
                            <div className="flex gap-2 p-1 bg-muted/30 rounded-lg mb-4 text-xs font-semibold w-full">
                                <button onClick={() => setPreviewTab("site")} className={`flex-1 py-1.5 rounded-md transition-colors flex justify-center items-center gap-1.5 ${previewTab === "site" ? "text-slate-800 bg-white shadow-sm ring-1 ring-black/5" : "text-slate-500 hover:text-slate-700 hover:bg-white/50"}`}><Eye size={14} /> Site</button>
                                <button onClick={() => setPreviewTab("email")} className={`flex-1 py-1.5 rounded-md transition-colors flex justify-center items-center gap-1.5 ${previewTab === "email" ? "text-slate-800 bg-white shadow-sm ring-1 ring-black/5" : "text-slate-500 hover:text-slate-700 hover:bg-white/50"}`}><Mail size={14} /> E-mail</button>
                            </div>

                            <div className="mt-2 w-full max-w-full">
                                {previewTab === "site" && <FalhaEntregaTrackingPreview settings={settings} empresaNome={empresaNome} logoUrl={empresaLogoUrl} />}
                                {previewTab === "email" && <FalhaEntregaEmailPreview settings={settings} empresaNome={empresaNome} />}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
