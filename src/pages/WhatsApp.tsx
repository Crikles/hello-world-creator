import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    MessageCircle, Wifi, WifiOff, QrCode, Trash2, Send, Search,
    Loader2, Eye, Phone, RefreshCw, Power, Plug, Copy, Check, AlertCircle, Coins, Clock
} from "lucide-react";
import { useLoja } from "@/contexts/LojaContext";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SUPABASE_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp`;
const TRACKING_BASE_URL = "https://rastreio.logisticajltransportes.com/r";

const AVAILABLE_VARS = [
    { key: "{{nome}}", label: "Nome", desc: "Nome do cliente" },
    { key: "{{produto}}", label: "Produto", desc: "Nome do produto" },
    { key: "{{valor}}", label: "Valor", desc: "Valor do pedido (R$)" },
    { key: "{{codigo_rastreio}}", label: "Código Rastreio", desc: "Código de rastreio" },
    { key: "{{endereco}}", label: "Endereço", desc: "Endereço completo" },
    { key: "{{documento}}", label: "Documento", desc: "CPF/CNPJ do cliente" },
    { key: "{{email}}", label: "Email", desc: "E-mail do cliente" },
    { key: "{{telefone}}", label: "Telefone", desc: "Telefone do cliente" },
];

const DEFAULT_TEMPLATE = `Olá {{nome}}! 👋

Seu pedido *{{produto}}* no valor de *R$ {{valor}}* foi despachado!

📦 Código de Rastreio: *{{codigo_rastreio}}*

Clique no botão abaixo para acompanhar a entrega em tempo real:`;

function formatPhone(phone: string): string {
    const cleaned = phone.replace(/[\s\-\(\)\+\.]/g, "");
    if (cleaned.startsWith("55")) return cleaned;
    return "55" + cleaned;
}

function buildFullAddress(envio: any): string {
    const parts = [
        envio.cliente_endereco,
        envio.cliente_numero,
        envio.cliente_bairro,
        envio.cliente_cidade,
        envio.cliente_estado,
        envio.cliente_cep,
    ].filter(Boolean);
    return parts.join(", ");
}

function replaceVars(template: string, envio: any): string {
    return template
        .replace(/\{\{nome\}\}/g, envio.cliente_nome || "")
        .replace(/\{\{produto\}\}/g, formatProduto(envio.produto) || "")
        .replace(/\{\{valor\}\}/g, Number(envio.valor || 0).toFixed(2))
        .replace(/\{\{codigo_rastreio\}\}/g, envio.codigo_rastreio || "")
        .replace(/\{\{endereco\}\}/g, buildFullAddress(envio))
        .replace(/\{\{documento\}\}/g, envio.cliente_cpf || "")
        .replace(/\{\{email\}\}/g, envio.cliente_email || "")
        .replace(/\{\{telefone\}\}/g, envio.cliente_telefone || "");
}

function formatProduto(raw: string): string {
    try {
        const items = JSON.parse(raw);
        if (Array.isArray(items)) {
            return items.map((i: any) => `${i.nome} (x${i.quantidade})`).join(", ");
        }
    } catch { /* not JSON */ }
    return raw;
}

async function callWhatsApp(action: string, body: Record<string, unknown>) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Não autenticado");

    const res = await fetch(SUPABASE_FN_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action, ...body }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro na API");
    return data;
}

function getDaysRemaining(expiresAt: string | null): number | null {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function SubscriptionBadge({ expiresAt }: { expiresAt: string | null }) {
    const days = getDaysRemaining(expiresAt);
    if (days === null) return null;

    if (days <= 0) {
        return (
            <Badge variant="secondary" className="bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5">
                <AlertCircle className="h-3 w-3 mr-1" /> Expirada
            </Badge>
        );
    }
    if (days <= 5) {
        return (
            <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-500 text-[10px] px-2 py-0.5">
                <Clock className="h-3 w-3 mr-1" /> {days} dia{days > 1 ? "s" : ""} restante{days > 1 ? "s" : ""}
            </Badge>
        );
    }
    return (
        <Badge variant="secondary" className="bg-green-500/20 text-green-400 text-[10px] px-2 py-0.5">
            <Check className="h-3 w-3 mr-1" /> {days} dias restantes
        </Badge>
    );
}

export default function WhatsApp() {
    const { loja } = useLoja();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<"instance" | "template" | "send">("instance");
    const [phoneInput, setPhoneInput] = useState("");
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("todos");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
    const [sentIds, setSentIds] = useState<Set<string>>(new Set());
    const [failedIds, setFailedIds] = useState<Set<string>>(new Set());
    const [previewEnvio, setPreviewEnvio] = useState<any>(null);
    const [copiedVar, setCopiedVar] = useState<string | null>(null);

    // ── User credits ──
    const { data: creditos } = useQuery({
        queryKey: ["creditos", user?.id],
        queryFn: async () => {
            const { data } = await supabase
                .from("creditos")
                .select("saldo")
                .eq("user_id", user!.id)
                .maybeSingle();
            return data?.saldo ?? 0;
        },
        enabled: !!user?.id,
    });

    // ── WhatsApp price ──
    const { data: whatsappPrice = 29.99 } = useQuery({
        queryKey: ["system-config-whatsapp-price"],
        queryFn: async () => {
            const { data } = await supabase
                .from("system_config")
                .select("value")
                .eq("key", "custo_whatsapp")
                .maybeSingle();
            return data?.value ?? 29.99;
        },
    });

    // ── Instance data ──
    const { data: instance, isLoading: instanceLoading } = useQuery({
        queryKey: ["whatsapp-instance", loja?.id],
        queryFn: async () => {
            if (!loja?.id) return null;
            const { data, error } = await supabase
                .from("whatsapp_instances")
                .select("*")
                .eq("loja_id", loja.id)
                .maybeSingle();
            if (error) throw error;
            return data;
        },
        enabled: !!loja?.id,
    });

    const isExpired = instance?.expires_at ? new Date(instance.expires_at) < new Date() : true;
    const daysRemaining = getDaysRemaining(instance?.expires_at ?? null);

    // ── Config (template) ──
    const { data: config } = useQuery({
        queryKey: ["whatsapp-config", loja?.id],
        queryFn: async () => {
            if (!loja?.id) return null;
            const { data } = await supabase
                .from("postagem_config")
                .select("whatsapp_msg_template, whatsapp_btn_text, whatsapp_footer")
                .eq("loja_id", loja.id)
                .maybeSingle();
            return data;
        },
        enabled: !!loja?.id,
    });

    const [msgTemplate, setMsgTemplate] = useState(DEFAULT_TEMPLATE);
    const [btnText, setBtnText] = useState("📦 Rastrear Pedido");
    const [footerText, setFooterText] = useState("Obrigado pela sua compra!");

    useEffect(() => {
        if (config) {
            setMsgTemplate(config.whatsapp_msg_template || DEFAULT_TEMPLATE);
            setBtnText(config.whatsapp_btn_text || "📦 Rastrear Pedido");
            setFooterText(config.whatsapp_footer || "Obrigado pela sua compra!");
        }
    }, [config]);

    // ── Envios ──
    const { data: envios = [] } = useQuery({
        queryKey: ["envios", loja?.id],
        queryFn: async () => {
            if (!loja) return [];
            const { data, error } = await supabase
                .from("envios")
                .select("*")
                .eq("loja_id", loja.id)
                .is("deleted_at", null)
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!loja,
    });

    // Set preview envio
    useEffect(() => {
        if (envios.length > 0 && !previewEnvio) {
            setPreviewEnvio(envios[0]);
        }
    }, [envios, previewEnvio]);

    // ── Polling for status when connecting ──
    useEffect(() => {
        if (instance?.status !== "connecting") return;
        const interval = setInterval(async () => {
            try {
                await callWhatsApp("status", { loja_id: loja?.id });
                queryClient.invalidateQueries({ queryKey: ["whatsapp-instance", loja?.id] });
            } catch { /* ignore */ }
        }, 5000);
        return () => clearInterval(interval);
    }, [instance?.status, loja?.id, queryClient]);

    // ── Mutations ──
    const createInstanceMutation = useMutation({
        mutationFn: async () => {
            return callWhatsApp("init", { loja_id: loja!.id });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["whatsapp-instance"] });
            queryClient.invalidateQueries({ queryKey: ["creditos"] });
            toast.success("Instância criada com sucesso! Assinatura ativa por 30 dias.");
        },
        onError: (err: any) => toast.error(err.message || "Erro ao criar instância"),
    });

    const renewMutation = useMutation({
        mutationFn: async () => {
            return callWhatsApp("renew", { loja_id: loja!.id });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["whatsapp-instance"] });
            queryClient.invalidateQueries({ queryKey: ["creditos"] });
            toast.success("Assinatura renovada por mais 30 dias!");
        },
        onError: (err: any) => toast.error(err.message || "Erro ao renovar assinatura"),
    });

    const connectMutation = useMutation({
        mutationFn: async () => {
            return callWhatsApp("connect", {
                loja_id: loja!.id,
                ...(phoneInput ? { phone: formatPhone(phoneInput) } : {}),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["whatsapp-instance"] });
            toast.success(phoneInput ? "Código de pareamento gerado!" : "QR Code gerado!");
        },
        onError: (err: any) => toast.error(err.message || "Erro ao conectar"),
    });

    const disconnectMutation = useMutation({
        mutationFn: async () => callWhatsApp("disconnect", { loja_id: loja!.id }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["whatsapp-instance"] });
            toast.success("Desconectado com sucesso!");
        },
        onError: (err: any) => toast.error(err.message || "Erro ao desconectar"),
    });

    const deleteMutation = useMutation({
        mutationFn: async () => callWhatsApp("delete", { loja_id: loja!.id }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["whatsapp-instance"] });
            toast.success("Instância removida!");
        },
        onError: (err: any) => toast.error(err.message || "Erro ao remover"),
    });

    const refreshStatusMutation = useMutation({
        mutationFn: async () => callWhatsApp("status", { loja_id: loja!.id }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["whatsapp-instance"] });
        },
    });

    const saveTemplateMutation = useMutation({
        mutationFn: async () => {
            const { error } = await supabase
                .from("postagem_config")
                .update({
                    whatsapp_msg_template: msgTemplate,
                    whatsapp_btn_text: btnText,
                    whatsapp_footer: footerText,
                })
                .eq("loja_id", loja!.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["whatsapp-config"] });
            toast.success("Template salvo com sucesso!");
        },
        onError: () => toast.error("Erro ao salvar template"),
    });

    // ── Send message ──
    const sendMessage = useCallback(async (envio: any) => {
        if (!envio.cliente_telefone) {
            toast.error(`${envio.cliente_nome}: sem telefone cadastrado`);
            setFailedIds((prev) => new Set(prev).add(envio.id));
            return;
        }

        setSendingIds((prev) => new Set(prev).add(envio.id));
        try {
            const text = replaceVars(msgTemplate, envio);
            const trackingUrl = `${TRACKING_BASE_URL}/${envio.codigo_rastreio || ""}`;

            await callWhatsApp("send", {
                loja_id: loja!.id,
                number: formatPhone(envio.cliente_telefone),
                text,
                btn_text: btnText,
                btn_url: trackingUrl,
                footer: footerText,
            });

            setSentIds((prev) => new Set(prev).add(envio.id));
            toast.success(`Mensagem enviada para ${envio.cliente_nome}!`);
        } catch (err: any) {
            setFailedIds((prev) => new Set(prev).add(envio.id));
            toast.error(`Erro ao enviar para ${envio.cliente_nome}: ${err.message}`);
        } finally {
            setSendingIds((prev) => {
                const next = new Set(prev);
                next.delete(envio.id);
                return next;
            });
        }
    }, [msgTemplate, btnText, footerText, loja]);

    const handleSendSelected = async () => {
        const selected = envios.filter((e) => selectedIds.has(e.id));
        if (selected.length === 0) return toast.info("Selecione pelo menos 1 envio.");
        for (const envio of selected) {
            await sendMessage(envio);
            await new Promise((r) => setTimeout(r, 1500));
        }
        toast.success(`Envio em massa finalizado!`);
    };

    const insertVariable = (varKey: string) => {
        setMsgTemplate((prev) => prev + varKey);
        setCopiedVar(varKey);
        setTimeout(() => setCopiedVar(null), 1000);
    };

    // ── Filtered envios ──
    const filteredEnvios = envios.filter((e) => {
        const s = search.toLowerCase();
        const matchSearch =
            e.cliente_nome.toLowerCase().includes(s) ||
            e.produto.toLowerCase().includes(s) ||
            (e.codigo_rastreio && e.codigo_rastreio.toLowerCase().includes(s)) ||
            e.cliente_email.toLowerCase().includes(s);
        const matchStatus = filterStatus === "todos" || e.status === filterStatus;
        return matchSearch && matchStatus;
    });

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(filteredEnvios.map((e) => e.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const statusColor = instance?.status === "connected"
        ? "text-green-500"
        : instance?.status === "connecting"
            ? "text-yellow-500"
            : "text-red-400";

    const statusLabel = instance?.status === "connected"
        ? "Conectado"
        : instance?.status === "connecting"
            ? "Conectando..."
            : "Desconectado";

    const tabs = [
        { id: "instance" as const, label: "Instância", icon: Plug },
        { id: "template" as const, label: "Template", icon: MessageCircle },
        { id: "send" as const, label: "Enviar", icon: Send },
    ];

    const canAfford = (creditos ?? 0) >= whatsappPrice;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">WhatsApp</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Envie mensagens personalizadas de rastreio para seus clientes via WhatsApp.
                    </p>
                </div>
                {/* Balance indicator */}
                <div className="glass rounded-xl px-4 py-2 flex items-center gap-2">
                    <Coins className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-bold text-foreground">{Number(creditos ?? 0).toFixed(0)}</span>
                    <span className="text-xs text-muted-foreground">moedas</span>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                {tabs.map((tab) => (
                    <Button
                        key={tab.id}
                        variant={activeTab === tab.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setActiveTab(tab.id)}
                        className={activeTab === tab.id
                            ? "shimmer-btn"
                            : "glass border-primary/20 hover:border-primary/40"}
                    >
                        <tab.icon className="h-4 w-4 mr-1.5" />
                        {tab.label}
                    </Button>
                ))}
            </div>

            {/* ═══════ TAB 1: INSTANCE MANAGEMENT ═══════ */}
            {activeTab === "instance" && (
                <div className="space-y-4 animate-stagger-in">
                    <div className="glass glow-border rounded-xl p-6">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="p-2.5 rounded-xl bg-green-500/10">
                                <MessageCircle className="h-5 w-5 text-green-500" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-foreground">Instância WhatsApp</h2>
                                <p className="text-sm text-muted-foreground">
                                    Gerencie sua conexão com o WhatsApp. Assinatura mensal de {whatsappPrice} moedas.
                                </p>
                            </div>
                        </div>

                        {!instance ? (
                            /* No instance yet */
                            <div className="flex flex-col items-center py-8 text-center">
                                <div className="h-16 w-16 rounded-full bg-primary/5 flex items-center justify-center mb-4">
                                    <WifiOff className="h-8 w-8 text-muted-foreground/40" />
                                </div>
                                <p className="text-foreground font-medium">Nenhuma instância configurada</p>
                                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                                    Crie sua instância do WhatsApp para começar a enviar mensagens de rastreio.
                                </p>

                                {/* Price info */}
                                <div className="glass rounded-xl px-5 py-3 mt-4 flex items-center gap-3">
                                    <Coins className="h-5 w-5 text-amber-500" />
                                    <div className="text-left">
                                        <p className="text-sm font-semibold text-foreground">{whatsappPrice} moedas/mês</p>
                                        <p className="text-[10px] text-muted-foreground">Será debitado ao criar a instância. Sem reembolso.</p>
                                    </div>
                                </div>

                                {!canAfford && (
                                    <p className="text-xs text-red-400 mt-3 flex items-center gap-1">
                                        <AlertCircle className="h-3 w-3" />
                                        Saldo insuficiente. Você tem {Number(creditos ?? 0).toFixed(0)} moedas.
                                    </p>
                                )}

                                <Button
                                    className="shimmer-btn mt-5"
                                    onClick={() => createInstanceMutation.mutate()}
                                    disabled={createInstanceMutation.isPending || !canAfford}
                                >
                                    {createInstanceMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    <Plug className="h-4 w-4 mr-1.5" />
                                    Criar Instância ({whatsappPrice} moedas)
                                </Button>
                            </div>
                        ) : (
                            /* Instance exists */
                            <div className="space-y-5">
                                {/* Status bar */}
                                <div className="glass rounded-xl p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`h-3 w-3 rounded-full ${instance.status === "connected" ? "bg-green-500 animate-pulse" :
                                                instance.status === "connecting" ? "bg-yellow-500 animate-pulse" :
                                                    "bg-red-400"
                                            }`} />
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">{instance.instance_name}</p>
                                            <p className={`text-xs font-medium ${statusColor}`}>{statusLabel}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <SubscriptionBadge expiresAt={(instance as any).expires_at} />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => refreshStatusMutation.mutate()}
                                            disabled={refreshStatusMutation.isPending}
                                        >
                                            <RefreshCw className={`h-4 w-4 ${refreshStatusMutation.isPending ? "animate-spin" : ""}`} />
                                        </Button>
                                    </div>
                                </div>

                                {/* Subscription expired/expiring banner */}
                                {isExpired && (
                                    <div className="glass rounded-xl p-4 border border-red-500/30 flex items-center justify-between gap-3 flex-wrap">
                                        <div className="flex items-center gap-3">
                                            <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
                                            <div>
                                                <p className="text-sm font-semibold text-red-400">Assinatura expirada</p>
                                                <p className="text-xs text-muted-foreground">Renove para continuar enviando mensagens.</p>
                                            </div>
                                        </div>
                                        <Button
                                            size="sm"
                                            className="shimmer-btn"
                                            onClick={() => renewMutation.mutate()}
                                            disabled={renewMutation.isPending || !canAfford}
                                        >
                                            {renewMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                                            <Coins className="h-3.5 w-3.5 mr-1.5" />
                                            Renovar ({whatsappPrice} moedas)
                                        </Button>
                                    </div>
                                )}

                                {!isExpired && daysRemaining !== null && daysRemaining <= 5 && (
                                    <div className="glass rounded-xl p-4 border border-yellow-500/30 flex items-center justify-between gap-3 flex-wrap">
                                        <div className="flex items-center gap-3">
                                            <Clock className="h-5 w-5 text-yellow-500 shrink-0" />
                                            <div>
                                                <p className="text-sm font-semibold text-yellow-500">Assinatura expira em {daysRemaining} dia{daysRemaining > 1 ? "s" : ""}</p>
                                                <p className="text-xs text-muted-foreground">Renove agora para não perder o acesso ao envio.</p>
                                            </div>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="glass border-yellow-500/30 hover:border-yellow-500/50 text-yellow-500"
                                            onClick={() => renewMutation.mutate()}
                                            disabled={renewMutation.isPending || !canAfford}
                                        >
                                            {renewMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                                            <Coins className="h-3.5 w-3.5 mr-1.5" />
                                            Renovar ({whatsappPrice} moedas)
                                        </Button>
                                    </div>
                                )}

                                {/* Connect / QR code section */}
                                {instance.status === "disconnected" && (
                                    <div className="glass rounded-xl p-5 space-y-4">
                                        <h3 className="text-sm font-semibold text-foreground">Conectar ao WhatsApp</h3>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs text-muted-foreground mb-1 block">
                                                    Número de telefone (opcional — se informar, será gerado código de pareamento)
                                                </label>
                                                <div className="flex gap-2">
                                                    <Input
                                                        placeholder="5511999999999"
                                                        value={phoneInput}
                                                        onChange={(e) => setPhoneInput(e.target.value)}
                                                        className="flex-1 bg-transparent border-border/50"
                                                    />
                                                    <Button
                                                        onClick={() => connectMutation.mutate()}
                                                        disabled={connectMutation.isPending}
                                                        className="shimmer-btn"
                                                    >
                                                        {connectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                                        <QrCode className="h-4 w-4 mr-1.5" />
                                                        {phoneInput ? "Gerar Código" : "Gerar QR Code"}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {instance.status === "connecting" && (
                                    <div className="glass rounded-xl p-5 space-y-4">
                                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
                                            Aguardando conexão...
                                        </h3>

                                        {instance.qr_code && (
                                            <div className="flex flex-col items-center gap-3">
                                                <p className="text-xs text-muted-foreground">
                                                    Escaneie o QR Code abaixo no seu WhatsApp:
                                                </p>
                                                <div className="p-4 bg-white rounded-xl">
                                                    <img
                                                        src={instance.qr_code.startsWith("data:") ? instance.qr_code : `data:image/png;base64,${instance.qr_code}`}
                                                        alt="QR Code WhatsApp"
                                                        className="w-64 h-64 object-contain"
                                                    />
                                                </div>
                                                <p className="text-[10px] text-muted-foreground">
                                                    O QR Code atualiza automaticamente a cada 5 segundos.
                                                </p>
                                            </div>
                                        )}

                                        {instance.pairing_code && (
                                            <div className="flex flex-col items-center gap-3">
                                                <p className="text-xs text-muted-foreground">
                                                    Use o código de pareamento abaixo no seu WhatsApp:
                                                </p>
                                                <code className="text-2xl font-mono font-bold text-primary bg-primary/10 px-6 py-3 rounded-xl tracking-[0.3em]">
                                                    {instance.pairing_code}
                                                </code>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {instance.status === "connected" && (
                                    <div className="glass rounded-xl p-5 flex items-center gap-4">
                                        <div className="p-3 rounded-xl bg-green-500/10">
                                            <Wifi className="h-6 w-6 text-green-500" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">WhatsApp conectado!</p>
                                            <p className="text-xs text-muted-foreground">
                                                Sua instância está pronta para enviar mensagens.
                                                {instance.phone && ` Telefone: ${instance.phone}`}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Action buttons */}
                                <div className="flex gap-2 flex-wrap">
                                    {instance.status === "connected" && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="glass border-yellow-500/30 hover:border-yellow-500/50 text-yellow-500"
                                            onClick={() => disconnectMutation.mutate()}
                                            disabled={disconnectMutation.isPending}
                                        >
                                            {disconnectMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                                            <Power className="h-3.5 w-3.5 mr-1.5" />
                                            Desconectar
                                        </Button>
                                    )}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="glass border-red-500/30 hover:border-red-500/50 text-red-500"
                                        onClick={() => {
                                            if (confirm("Tem certeza que deseja remover a instância? As moedas não serão reembolsadas.")) {
                                                deleteMutation.mutate();
                                            }
                                        }}
                                        disabled={deleteMutation.isPending}
                                    >
                                        {deleteMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                        Remover Instância
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══════ TAB 2: TEMPLATE EDITOR ═══════ */}
            {activeTab === "template" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-stagger-in">
                    {/* Editor */}
                    <div className="glass glow-border rounded-xl p-6 space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2.5 rounded-xl bg-primary/10">
                                <MessageCircle className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-foreground">Editor de Mensagem</h2>
                                <p className="text-xs text-muted-foreground">
                                    Personalize a mensagem usando as variáveis disponíveis.
                                </p>
                            </div>
                        </div>

                        {/* Variables */}
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-2 block">
                                Variáveis disponíveis (clique para inserir)
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                                {AVAILABLE_VARS.map((v) => (
                                    <Badge
                                        key={v.key}
                                        variant="secondary"
                                        className="cursor-pointer hover:bg-primary/20 hover:text-primary transition-colors text-[10px] px-2 py-1"
                                        onClick={() => insertVariable(v.key)}
                                        title={v.desc}
                                    >
                                        {copiedVar === v.key ? <Check className="h-3 w-3 mr-1" /> : null}
                                        {v.label}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        {/* Template textarea */}
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                                Mensagem
                            </label>
                            <Textarea
                                value={msgTemplate}
                                onChange={(e) => setMsgTemplate(e.target.value)}
                                className="min-h-[200px] bg-transparent border-border/50 font-mono text-sm"
                                placeholder="Digite sua mensagem com variáveis..."
                            />
                        </div>

                        {/* Button text */}
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                                Texto do Botão de Rastreio
                            </label>
                            <Input
                                value={btnText}
                                onChange={(e) => setBtnText(e.target.value)}
                                className="bg-transparent border-border/50"
                                placeholder="📦 Rastrear Pedido"
                            />
                        </div>

                        {/* Footer */}
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                                Texto do Rodapé (opcional)
                            </label>
                            <Input
                                value={footerText}
                                onChange={(e) => setFooterText(e.target.value)}
                                className="bg-transparent border-border/50"
                                placeholder="Obrigado pela sua compra!"
                            />
                        </div>

                        <Button
                            className="shimmer-btn w-full"
                            onClick={() => saveTemplateMutation.mutate()}
                            disabled={saveTemplateMutation.isPending}
                        >
                            {saveTemplateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Salvar Template
                        </Button>
                    </div>

                    {/* Preview */}
                    <div className="glass glow-border rounded-xl p-6 space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2.5 rounded-xl bg-green-500/10">
                                <Eye className="h-5 w-5 text-green-500" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-foreground">Pré-visualização</h2>
                                <p className="text-xs text-muted-foreground">
                                    Veja como a mensagem será exibida no WhatsApp.
                                </p>
                            </div>
                        </div>

                        {/* WhatsApp-style preview */}
                        <div className="rounded-xl bg-[#0b141a] p-4 space-y-3 min-h-[300px]">
                            {/* Chat bubble */}
                            <div className="max-w-[85%] ml-auto">
                                <div className="bg-[#005c4b] rounded-xl rounded-tr-sm p-3 shadow-lg">
                                    <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">
                                        {previewEnvio
                                            ? replaceVars(msgTemplate, previewEnvio)
                                            : replaceVars(msgTemplate, {
                                                cliente_nome: "João Silva",
                                                produto: "Tênis Nike Air Max",
                                                valor: 299.90,
                                                codigo_rastreio: "BR123456789XX",
                                                cliente_endereco: "Rua das Flores",
                                                cliente_numero: "123",
                                                cliente_bairro: "Centro",
                                                cliente_cidade: "São Paulo",
                                                cliente_estado: "SP",
                                                cliente_cep: "01000-000",
                                                cliente_cpf: "123.456.789-00",
                                                cliente_email: "joao@email.com",
                                                cliente_telefone: "11999999999",
                                            })}
                                    </p>

                                    {/* Button preview */}
                                    <div className="mt-3 pt-2 border-t border-white/10">
                                        <div className="text-center py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                            <span className="text-[#53bdeb] text-sm font-medium">
                                                🔗 {btnText}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    {footerText && (
                                        <p className="text-[10px] text-white/40 mt-2">{footerText}</p>
                                    )}
                                </div>
                                <p className="text-[10px] text-white/30 text-right mt-1">10:07</p>
                            </div>
                        </div>

                        {/* Select envio for preview */}
                        {envios.length > 0 && (
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                                    Selecione um envio para visualizar com dados reais
                                </label>
                                <Select
                                    value={previewEnvio?.id || ""}
                                    onValueChange={(val) => {
                                        const envio = envios.find((e) => e.id === val);
                                        if (envio) setPreviewEnvio(envio);
                                    }}
                                >
                                    <SelectTrigger className="bg-transparent border-border/50">
                                        <SelectValue placeholder="Escolher envio..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {envios.slice(0, 20).map((e) => (
                                            <SelectItem key={e.id} value={e.id}>
                                                {e.cliente_nome} — {formatProduto(e.produto)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══════ TAB 3: SEND MESSAGES ═══════ */}
            {activeTab === "send" && (
                <div className="space-y-4 animate-stagger-in">
                    {/* Warning if not connected */}
                    {instance?.status !== "connected" && (
                        <div className="glass rounded-xl p-4 flex items-center gap-3 border border-yellow-500/30">
                            <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0" />
                            <p className="text-sm text-yellow-500">
                                Sua instância WhatsApp não está conectada. Vá para a aba "Instância" para conectar antes de enviar mensagens.
                            </p>
                        </div>
                    )}

                    {/* Warning if subscription expired */}
                    {instance && isExpired && (
                        <div className="glass rounded-xl p-4 flex items-center justify-between gap-3 border border-red-500/30 flex-wrap">
                            <div className="flex items-center gap-3">
                                <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
                                <p className="text-sm text-red-400">
                                    Assinatura expirada. Renove para enviar mensagens.
                                </p>
                            </div>
                            <Button
                                size="sm"
                                className="shimmer-btn"
                                onClick={() => renewMutation.mutate()}
                                disabled={renewMutation.isPending || !canAfford}
                            >
                                {renewMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                                Renovar ({whatsappPrice} moedas)
                            </Button>
                        </div>
                    )}

                    {/* Action bar */}
                    <div className="glass-strong glow-border rounded-xl p-3">
                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 glass rounded-lg px-3 py-1.5">
                                    <Checkbox
                                        checked={filteredEnvios.length > 0 && selectedIds.size === filteredEnvios.length}
                                        onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                        className="h-4 w-4 border-primary/30"
                                    />
                                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Tudo</span>
                                </div>

                                {selectedIds.size > 0 && (
                                    <Button
                                        size="sm"
                                        className="shimmer-btn h-8 text-xs"
                                        onClick={handleSendSelected}
                                        disabled={instance?.status !== "connected" || sendingIds.size > 0 || isExpired}
                                    >
                                        {sendingIds.size > 0 ? (
                                            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                        ) : (
                                            <Send className="h-3.5 w-3.5 mr-1" />
                                        )}
                                        Enviar ({selectedIds.size})
                                    </Button>
                                )}
                            </div>

                            <div className="flex gap-2 items-center w-full sm:w-auto">
                                <div className="relative flex-1 sm:w-56">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar nome, produto..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="pl-8 h-8 text-xs bg-transparent border-border/50"
                                    />
                                </div>
                                <Select value={filterStatus} onValueChange={setFilterStatus}>
                                    <SelectTrigger className="w-[120px] h-8 text-xs bg-transparent border-border/50">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos Status</SelectItem>
                                        <SelectItem value="pendente">Pendente</SelectItem>
                                        <SelectItem value="coletado">Coletado</SelectItem>
                                        <SelectItem value="em_transito">Em Trânsito</SelectItem>
                                        <SelectItem value="saiu_para_entrega">Saiu p/ Entrega</SelectItem>
                                        <SelectItem value="entregue">Entregue</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Envio list */}
                    {filteredEnvios.length === 0 ? (
                        <div className="flex flex-col items-center py-16 text-center">
                            <div className="h-16 w-16 rounded-full bg-primary/5 flex items-center justify-center mb-4">
                                <Send className="h-8 w-8 text-muted-foreground/30" />
                            </div>
                            <p className="text-foreground font-medium">Nenhum envio encontrado</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Adicione envios na aba "Envios" para enviar mensagens via WhatsApp.
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1.5">
                            {filteredEnvios.map((envio, idx) => {
                                const isSending = sendingIds.has(envio.id);
                                const isSent = sentIds.has(envio.id);
                                const isFailed = failedIds.has(envio.id);
                                const hasPhone = !!envio.cliente_telefone;

                                return (
                                    <div
                                        key={envio.id}
                                        className="glass glow-border-hover rounded-lg px-3 py-2.5 transition-all duration-200 hover:bg-primary/5 animate-stagger-in group"
                                        style={{ animationDelay: `${idx * 0.02}s` }}
                                    >
                                        <div className="flex items-center gap-3 flex-wrap md:flex-nowrap">
                                            <Checkbox
                                                checked={selectedIds.has(envio.id)}
                                                onCheckedChange={() => toggleSelect(envio.id)}
                                                className="h-4 w-4 border-primary/30 shrink-0"
                                            />

                                            {/* Name + Phone */}
                                            <div className="min-w-0 w-40 shrink-0">
                                                <p className="text-sm font-medium text-foreground truncate leading-tight">
                                                    {envio.cliente_nome}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                                                    <Phone className="h-2.5 w-2.5" />
                                                    {hasPhone ? envio.cliente_telefone : <span className="text-red-400">Sem telefone</span>}
                                                </p>
                                            </div>

                                            {/* Product */}
                                            <p className="text-[11px] text-muted-foreground truncate hidden md:block w-32 shrink-0">
                                                {formatProduto(envio.produto)}
                                            </p>

                                            {/* Tracking code */}
                                            <code className="text-[10px] text-primary/70 bg-primary/5 px-2 py-0.5 rounded font-mono hidden lg:block shrink-0">
                                                {envio.codigo_rastreio || "—"}
                                            </code>

                                            {/* Value */}
                                            <span className="text-sm font-bold text-primary whitespace-nowrap shrink-0">
                                                R$ {Number(envio.valor).toFixed(2)}
                                            </span>

                                            {/* Status indicator */}
                                            <div className="flex items-center gap-2 ml-auto shrink-0">
                                                {isSent && (
                                                    <Badge variant="secondary" className="bg-green-500/20 text-green-500 text-[9px] px-1.5 py-0 h-5">
                                                        <Check className="h-3 w-3 mr-0.5" /> Enviado
                                                    </Badge>
                                                )}
                                                {isFailed && (
                                                    <Badge variant="secondary" className="bg-red-500/20 text-red-500 text-[9px] px-1.5 py-0 h-5">
                                                        <AlertCircle className="h-3 w-3 mr-0.5" /> Falhou
                                                    </Badge>
                                                )}

                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 hover:bg-green-500/10"
                                                    onClick={() => sendMessage(envio)}
                                                    disabled={isSending || instance?.status !== "connected" || isExpired}
                                                    title={isExpired ? "Assinatura expirada" : "Enviar mensagem"}
                                                >
                                                    {isSending ? (
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin text-green-500" />
                                                    ) : (
                                                        <Send className="h-3.5 w-3.5 text-green-500" />
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
