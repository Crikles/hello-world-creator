import { useState, useEffect, useCallback } from "react";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
    MessageCircle, Wifi, WifiOff, QrCode, Trash2, Send, Search,
    Loader2, Eye, Phone, RefreshCw, Power, Plug, Copy, Check, AlertCircle, Coins, Clock, Zap, RotateCcw, Reply, Pencil, X, Save, Smartphone
} from "lucide-react";
import { useLoja } from "@/contexts/LojaContext";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SUPABASE_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp`;
const TRACKING_BASE_URL = "https://rastreio.jltransportelogistica.com/r";

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
    const digits = phone.replace(/\D/g, "");
    // Brazilian local number (10-11 digits) → prepend 55
    if (digits.length === 10 || digits.length === 11) return "55" + digits;
    // Already has country code (12-13 digits starting with 55)
    if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
    // International or other → return as-is
    return digits;
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

function formatWhatsAppText(text: string): string {
    let html = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    // Bold: *text*
    html = html.replace(/\*([^*]+)\*/g, "<b>$1</b>");
    // Italic: _text_
    html = html.replace(/_([^_]+)_/g, "<i>$1</i>");
    // Strikethrough: ~text~
    html = html.replace(/~([^~]+)~/g, "<s>$1</s>");
    // Monospace: ```text```
    html = html.replace(/```([^`]+)```/g, "<code>$1</code>");
    return html;
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

function formatDateBR(date: string | null): string {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getSignedDays(createdAt: string | null): number {
    if (!createdAt) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)));
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
    const [sendSubTab, setSendSubTab] = useState<"pendentes" | "enviados">("pendentes");
    const [pendentesPage, setPendentesPage] = useState(1);
    const PENDENTES_PER_PAGE = 20;
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
    const [failedIds, setFailedIds] = useState<Set<string>>(new Set());
    const [failReasons, setFailReasons] = useState<Record<string, string>>({});
    const [previewEnvio, setPreviewEnvio] = useState<any>(null);
    const [copiedVar, setCopiedVar] = useState<string | null>(null);
    const [connectData, setConnectData] = useState<{ instanceId: string; qrCode?: string; pairingCode?: string } | null>(null);
    const [connectingStartedAt, setConnectingStartedAt] = useState<number | null>(null);
    const [selectedInstanceIds, setSelectedInstanceIds] = useState<Set<string>>(new Set());
    const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
    const [editingLabelValue, setEditingLabelValue] = useState("");
    const [nowTick, setNowTick] = useState(Date.now());
    const [retryingFailed, setRetryingFailed] = useState(false);

    const handleRetryFailed = async () => {
        if (!loja) return;
        setRetryingFailed(true);
        try {
            const { data, error } = await supabase.functions.invoke("retry-failed-sends", {
                body: { loja_id: loja.id },
            });
            if (error) throw error;
            if (data?.success === false) {
                toast.error("Saldo ainda insuficiente. Recarregue antes de reenviar.");
            } else {
                toast.success(`${data?.whatsapp || 0} mensagens reenfileiradas.`);
                queryClient.invalidateQueries({ queryKey: ["whatsapp-message-log", loja.id] });
                queryClient.invalidateQueries({ queryKey: ["whatsapp-queue", loja.id] });
            }
        } catch (err: any) {
            toast.error("Erro ao reenviar: " + err.message);
        } finally {
            setRetryingFailed(false);
        }
    };

    // Tick every second for the countdown
    useEffect(() => {
        const t = setInterval(() => setNowTick(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    // ── Next scheduled WhatsApp from the queue (for countdown) ──
    const { data: nextQueued } = useQuery({
        queryKey: ["wa-next-queued", loja?.id],
        queryFn: async () => {
            if (!loja) return null;
            const { data } = await supabase
                .from("whatsapp_send_queue")
                .select("scheduled_at, envio_id, envios:envio_id(cliente_nome)")
                .eq("loja_id", loja.id)
                .eq("status", "pending")
                .order("scheduled_at", { ascending: true })
                .limit(1)
                .maybeSingle();
            if (!data) return null;
            const nome = (data as any).envios?.cliente_nome ?? null;
            return { scheduled_at: data.scheduled_at, cliente_nome: nome };
        },
        enabled: !!loja,
        refetchInterval: 15000,
    });
    const nextScheduled = nextQueued?.scheduled_at || null;
    const nextClienteNome = nextQueued?.cliente_nome || null;


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

    // ── WhatsApp price (custom_prices overrides system_config) ──
    const billingUserId = loja?.user_id || user?.id;
    const { data: whatsappPrice = 49 } = useQuery({
        queryKey: ["whatsapp-price", billingUserId],
        queryFn: async () => {
            // 1. Check user custom price first
            if (billingUserId) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("custom_prices")
                    .eq("id", billingUserId)
                    .maybeSingle();
                const custom = profile?.custom_prices as Record<string, number | string> | null;
                if (custom && custom.custo_whatsapp != null) {
                    const customPrice = Number(custom.custo_whatsapp);
                    if (!Number.isNaN(customPrice)) return customPrice;
                }
            }

            // 2. Fallback to global system_config
            const { data } = await supabase
                .from("system_config")
                .select("value")
                .eq("key", "custo_whatsapp")
                .maybeSingle();
            return data?.value ?? 49;
        },
        enabled: !!billingUserId,
    });

    // ── ALL instances for this loja (multiple) ──
    const { data: instances = [], isLoading: instanceLoading } = useQuery({
        queryKey: ["whatsapp-instances", loja?.id],
        queryFn: async () => {
            if (!loja?.id) return [];
            const { data, error } = await supabase
                .from("whatsapp_instances")
                .select("*")
                .eq("loja_id", loja.id)
                .order("created_at", { ascending: true });
            if (error) throw error;
            return data || [];
        },
        enabled: !!loja?.id,
    });

    // ── Subscriptions (free slots) ──
    const { data: subsInfo } = useQuery({
        queryKey: ["whatsapp-subscriptions", loja?.id],
        queryFn: async () => {
            if (!loja?.id) return { free_slots: 0, total_active: 0, subscriptions: [] };
            const result = await callWhatsApp("list-subscriptions", { loja_id: loja.id });
            return result as { free_slots: number; total_active: number; subscriptions: any[] };
        },
        enabled: !!loja?.id,
    });

    const totalActiveSubs = subsInfo?.total_active ?? 0;
    const freeSlots = Math.max(0, totalActiveSubs - instances.length);
    const subscriptions = subsInfo?.subscriptions ?? [];

    // Compat: first instance for backwards compat in tabs
    const instance = instances.length > 0 ? instances[0] : null;
    const isExpired = instance?.expires_at ? new Date(instance.expires_at) < new Date() : true;
    const daysRemaining = getDaysRemaining(instance?.expires_at ?? null);

    const connectedInstances = instances.filter((i) => i.status === "connected" && i.expires_at && new Date(i.expires_at) > new Date());

    // Auto-select all connected instances on first load
    useEffect(() => {
        if (connectedInstances.length > 0 && selectedInstanceIds.size === 0) {
            setSelectedInstanceIds(new Set(connectedInstances.map((i) => i.id)));
        }
    }, [connectedInstances.length]);

    // ── Message log (persistent sent tracking) ──
    const { data: messageLogs = [] } = useQuery({
        queryKey: ["whatsapp-message-log", loja?.id],
        queryFn: async () => {
            if (!loja?.id) return [];
            const { data } = await supabase
                .from("whatsapp_message_log")
                .select("envio_id, status, created_at, error_reason, instance_id, instance:instance_id(label, instance_name)")
                .eq("loja_id", loja.id);
            return data || [];
        },
        enabled: !!loja?.id,
    });

    const sentEnvioIds = new Set(messageLogs.filter((l) => l.status === "sent").map((l) => l.envio_id));
    const failedEnvioIds = new Set(messageLogs.filter((l) => l.status === "failed").map((l) => l.envio_id));
    const failedSaldoCount = messageLogs.filter((l: any) => {
        if (l.status !== "failed") return false;
        const r = (l.error_reason || "").toLowerCase();
        return r.includes("saldo") || r.includes("insufic");
    }).length;
    const messageLogMap = Object.fromEntries(
        messageLogs.map((l: any) => [l.envio_id, {
            status: l.status,
            created_at: l.created_at,
            error_reason: l.error_reason,
            instance_label: l.instance?.label || l.instance?.instance_name || null,
        }])
    );

    // ── Config (template + auto-send) ──
    const { data: config } = useQuery({
        queryKey: ["whatsapp-config", loja?.id],
        queryFn: async () => {
            if (!loja?.id) return null;
            const { data } = await supabase
                .from("postagem_config")
                .select("whatsapp_msg_template, whatsapp_btn_text, whatsapp_footer, whatsapp_auto_send, whatsapp_delay_seconds, whatsapp_image_url, whatsapp_reply_text, whatsapp_btn2_text, whatsapp_btn2_url")
                .eq("loja_id", loja.id)
                .maybeSingle();
            return data;
        },
        enabled: !!loja?.id,
    });

    const [msgTemplate, setMsgTemplate] = useState(DEFAULT_TEMPLATE);
    const [btnText, setBtnText] = useState("📦 Rastrear Pedido");
    const [footerText, setFooterText] = useState("Obrigado pela sua compra!");
    const [imageUrl, setImageUrl] = useState("");
    const [replyText, setReplyText] = useState("Quero acompanhar meu pedido");
    const [btn2Text, setBtn2Text] = useState("");
    const [btn2Url, setBtn2Url] = useState("");
    const [autoSend, setAutoSend] = useState(false);
    const [delayMinutes, setDelayMinutes] = useState(5);

    useEffect(() => {
        if (config) {
            setMsgTemplate(config.whatsapp_msg_template || DEFAULT_TEMPLATE);
            setBtnText(config.whatsapp_btn_text || "📦 Rastrear Pedido");
            setFooterText(config.whatsapp_footer || "Obrigado pela sua compra!");
            setImageUrl((config as any).whatsapp_image_url || "");
            setReplyText((config as any).whatsapp_reply_text || "Quero acompanhar meu pedido");
            setBtn2Text((config as any).whatsapp_btn2_text || "");
            setBtn2Url((config as any).whatsapp_btn2_url || "");
            setAutoSend(!!(config as any).whatsapp_auto_send);
            setDelayMinutes(Math.round(((config as any).whatsapp_delay_seconds || 300) / 60));
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
        const connectingInstance = instances.find((i) => i.status === "connecting");
        if (!connectingInstance) {
            // If no connecting instance and we have connectData, check if it got connected
            if (connectData) {
                const inst = instances.find((i) => i.id === connectData.instanceId);
                if (inst && inst.status === "connected") {
                    setConnectData(null);
                    setConnectingStartedAt(null);
                }
            }
            return;
        }
        const interval = setInterval(async () => {
            try {
                const result = await callWhatsApp("status", { loja_id: loja?.id, instance_id: connectingInstance.id });
                // If status came back as disconnected but we just started connecting (< 2 min), keep connecting state
                const elapsed = connectingStartedAt ? Date.now() - connectingStartedAt : Infinity;
                if (result.status === "disconnected" && elapsed < 120000) {
                    // Don't refetch — keep showing QR/pairing code
                    return;
                }
                queryClient.invalidateQueries({ queryKey: ["whatsapp-instances", loja?.id] });
            } catch { /* ignore */ }
        }, 5000);
        return () => clearInterval(interval);
    }, [instances, loja?.id, queryClient, connectData, connectingStartedAt]);

    // ── Mutations ──
    const createInstanceMutation = useMutation({
        mutationFn: async () => {
            return callWhatsApp("init", { loja_id: loja!.id });
        },
        onSuccess: async (data: any) => {
            await Promise.all([
                queryClient.refetchQueries({ queryKey: ["whatsapp-instances", loja?.id] }),
                queryClient.refetchQueries({ queryKey: ["whatsapp-subscriptions", loja?.id] }),
                queryClient.refetchQueries({ queryKey: ["creditos", user?.id] }),
            ]);
            if (data.used_free_slot) {
                toast.success("Instância criada usando slot disponível — sem custo!");
            } else {
                toast.success("Instância criada com sucesso! Assinatura ativa por 30 dias.");
            }
        },
        onError: (err: any) => toast.error(err.message || "Erro ao criar instância"),
    });

    const renewMutation = useMutation({
        mutationFn: async (instanceId: string) => {
            return callWhatsApp("renew", { loja_id: loja!.id, instance_id: instanceId });
        },
        onSuccess: async () => {
            await Promise.all([
                queryClient.refetchQueries({ queryKey: ["whatsapp-instances", loja?.id] }),
                queryClient.refetchQueries({ queryKey: ["whatsapp-subscriptions", loja?.id] }),
                queryClient.refetchQueries({ queryKey: ["creditos", user?.id] }),
            ]);
            toast.success("Assinatura renovada por mais 30 dias!");
        },
        onError: (err: any) => toast.error(err.message || "Erro ao renovar assinatura"),
    });

    const connectMutation = useMutation({
        mutationFn: async (instanceId: string) => {
            return callWhatsApp("connect", {
                loja_id: loja!.id,
                instance_id: instanceId,
                ...(phoneInput ? { phone: formatPhone(phoneInput) } : {}),
            });
        },
        onSuccess: (data: any, instanceId: string) => {
            // Store connect response locally so QR/pairing shows immediately
            setConnectData({
                instanceId,
                qrCode: data.qrcode || data.qr_code || undefined,
                pairingCode: data.pairingCode || data.pairing_code || undefined,
            });
            setConnectingStartedAt(Date.now());
            queryClient.invalidateQueries({ queryKey: ["whatsapp-instances", loja?.id] });
            toast.success(phoneInput ? "Código de pareamento gerado!" : "QR Code gerado!");
        },
        onError: (err: any) => toast.error(err.message || "Erro ao conectar"),
    });

    const disconnectMutation = useMutation({
        mutationFn: async (instanceId: string) => callWhatsApp("disconnect", { loja_id: loja!.id, instance_id: instanceId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
            toast.success("Desconectado com sucesso!");
        },
        onError: (err: any) => toast.error(err.message || "Erro ao desconectar"),
    });

    const deleteMutation = useMutation({
        mutationFn: async (instanceId: string) => callWhatsApp("delete", { loja_id: loja!.id, instance_id: instanceId }),
        onSuccess: async () => {
            setConnectData(null);
            setConnectingStartedAt(null);
            await Promise.all([
                queryClient.refetchQueries({ queryKey: ["whatsapp-instances", loja?.id] }),
                queryClient.refetchQueries({ queryKey: ["whatsapp-subscriptions", loja?.id] }),
            ]);
            toast.success("Instância removida! Sua assinatura continua ativa — você pode criar uma nova instância sem custo.");
        },
        onError: (err: any) => toast.error(err.message || "Erro ao remover"),
    });

    const refreshStatusMutation = useMutation({
        mutationFn: async (instanceId: string) => callWhatsApp("status", { loja_id: loja!.id, instance_id: instanceId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
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
                    whatsapp_image_url: imageUrl || null,
                    whatsapp_reply_text: replyText || null,
                    whatsapp_btn2_text: btn2Text || null,
                    whatsapp_btn2_url: btn2Url || null,
                } as any)
                .eq("loja_id", loja!.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["whatsapp-config"] });
            toast.success("Template salvo com sucesso!");
        },
        onError: () => toast.error("Erro ao salvar template"),
    });

    const saveAutoSendMutation = useMutation({
        mutationFn: async ({ auto, delay }: { auto: boolean; delay: number }) => {
            const update: any = {
                whatsapp_auto_send: auto,
                whatsapp_delay_seconds: delay * 60,
            };
            // Quando ativa o auto-envio, marca o instante para que apenas leads novos sejam considerados
            if (auto) {
                update.whatsapp_auto_send_started_at = new Date().toISOString();
            }
            const { error } = await supabase
                .from("postagem_config")
                .update(update)
                .eq("loja_id", loja!.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["whatsapp-config"] });
            toast.success("Configurações de automação salvas!");
        },
        onError: () => toast.error("Erro ao salvar configurações"),
    });

    // ── Save label mutation ──
    const saveLabelMutation = useMutation({
        mutationFn: async ({ id, label }: { id: string; label: string }) => {
            const { error } = await supabase
                .from("whatsapp_instances")
                .update({ label: label || null } as any)
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["whatsapp-instances", loja?.id] });
            setEditingLabelId(null);
            toast.success("Apelido salvo!");
        },
        onError: () => toast.error("Erro ao salvar apelido"),
    });

    // ── Send message ──
    const sendMessage = useCallback(async (envio: any) => {
        if (!envio.cliente_telefone) {
            const reason = "Sem telefone cadastrado";
            toast.error(`${envio.cliente_nome}: ${reason}`);
            setFailedIds((prev) => new Set(prev).add(envio.id));
            setFailReasons((prev) => ({ ...prev, [envio.id]: reason }));
            return;
        }

        setSendingIds((prev) => new Set(prev).add(envio.id));
        try {
            const text = replaceVars(msgTemplate, envio);
            const trackingUrl = `${TRACKING_BASE_URL}/${envio.codigo_rastreio || ""}`;

            // Pick a specific instance if only one selected, otherwise let backend rotate
            const instanceIdsArray = Array.from(selectedInstanceIds);
            const instanceParam = instanceIdsArray.length === 1 ? { instance_id: instanceIdsArray[0] } : {};

            await callWhatsApp("send", {
                loja_id: loja!.id,
                number: formatPhone(envio.cliente_telefone),
                text,
                btn_text: btnText,
                btn_url: trackingUrl,
                footer: footerText,
                envio_id: envio.id,
                image_url: imageUrl || undefined,
                reply_text: replyText || undefined,
                btn2_text: btn2Text || undefined,
                btn2_url: btn2Url || undefined,
                ...instanceParam,
            });

            queryClient.invalidateQueries({ queryKey: ["whatsapp-message-log"] });
            toast.success(`Mensagem enviada para ${envio.cliente_nome}!`);
        } catch (err: any) {
            const reason = err.message || "Erro desconhecido";
            setFailedIds((prev) => new Set(prev).add(envio.id));
            setFailReasons((prev) => ({ ...prev, [envio.id]: reason }));
            toast.error(`Erro ao enviar para ${envio.cliente_nome}: ${reason}`);
        } finally {
            setSendingIds((prev) => {
                const next = new Set(prev);
                next.delete(envio.id);
                return next;
            });
        }
    }, [msgTemplate, btnText, footerText, loja, queryClient, imageUrl, replyText, btn2Text, btn2Url, selectedInstanceIds]);

    const handleSendSelected = async () => {
        const selected = envios.filter((e) => selectedIds.has(e.id));
        if (selected.length === 0) return toast.info("Selecione pelo menos 1 envio.");

        const delayBetweenMs = Math.max(delayMinutes * 60 * 1000, 1500);

        if (connectedInstances.length > 1 && selectedInstanceIds.size > 1) {
            // Use send-queue: messages are queued in DB and processed by cron with proper delays
            setSendingIds(new Set(selected.map((e) => e.id)));
            try {
                const result = await callWhatsApp("send-queue", {
                    loja_id: loja!.id,
                    envio_ids: selected.map((e) => e.id),
                    msg_template: msgTemplate,
                    btn_text: btnText,
                    btn_url_template: `${TRACKING_BASE_URL}/{{codigo_rastreio}}`,
                    footer: footerText,
                    btn2_text: btn2Text || undefined,
                    btn2_url: btn2Url || undefined,
                    ...(selectedInstanceIds.size > 0 ? { instance_ids: Array.from(selectedInstanceIds) } : {}),
                });
                const queued = result?.queued || selected.length;
                const estMinutes = result?.estimated_minutes || "?";
                toast.success(`${queued} mensagens enfileiradas! Serão enviadas automaticamente em ~${estMinutes} min com rotação entre ${selectedInstanceIds.size} instâncias.`);
                setSelectedIds(new Set());
            } catch (err: any) {
                toast.error(err.message || "Erro no envio em massa");
            } finally {
                setSendingIds(new Set());
            }
        } else {
            // Single instance — send individually with configured delay from frontend
            for (let i = 0; i < selected.length; i++) {
                await sendMessage(selected[i]);
                if (i < selected.length - 1) {
                    await new Promise((r) => setTimeout(r, delayBetweenMs));
                }
            }
            toast.success(`Envio em massa finalizado!`);
        }
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

        if (!matchSearch) return false;

        if (sendSubTab === "pendentes") return !sentEnvioIds.has(e.id);
        if (sendSubTab === "enviados") return sentEnvioIds.has(e.id);
        return true;
    });

    // Counts for sub-tab badges
    const pendentesCount = envios.filter((e) => !sentEnvioIds.has(e.id)).length;
    const enviadosCount = envios.filter((e) => sentEnvioIds.has(e.id)).length;

    // Pagination only for "pendentes" tab
    const totalPendentesPages = sendSubTab === "pendentes"
        ? Math.max(1, Math.ceil(filteredEnvios.length / PENDENTES_PER_PAGE))
        : 1;
    const currentPendentesPage = Math.min(pendentesPage, totalPendentesPages);
    const visibleEnvios = sendSubTab === "pendentes"
        ? filteredEnvios.slice((currentPendentesPage - 1) * PENDENTES_PER_PAGE, currentPendentesPage * PENDENTES_PER_PAGE)
        : filteredEnvios;

    // Reset to page 1 when tab or search changes
    useEffect(() => { setPendentesPage(1); }, [sendSubTab, search]);

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
                {/* Balance indicator - FIXED: .toFixed(2) */}
                <div className="glass rounded-xl px-4 py-2 flex items-center gap-2">
                    <Coins className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-bold text-foreground">{Number(creditos ?? 0).toFixed(2)}</span>
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
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-green-500/10">
                                    <MessageCircle className="h-5 w-5 text-green-500" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-foreground">Instâncias WhatsApp</h2>
                                    <p className="text-sm text-muted-foreground">
                                        Gerencie suas conexões. Assinatura de {whatsappPrice} moedas/mês por instância.
                                    </p>
                                </div>
                            </div>
                            {instances.length > 0 && (
                                <Button
                                    size="sm"
                                    className="shimmer-btn"
                                    onClick={() => createInstanceMutation.mutate()}
                                    disabled={createInstanceMutation.isPending || (freeSlots === 0 && !canAfford)}
                                >
                                    {createInstanceMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                                    <Plug className="h-3.5 w-3.5 mr-1.5" />
                                    {freeSlots > 0 ? "Usar Slot Disponível" : `Nova Instância (${whatsappPrice})`}
                                </Button>
                            )}
                        </div>

                        {/* Slots info banner */}
                        {totalActiveSubs > 0 && (
                            <div className="glass rounded-xl p-3 flex items-center justify-between mb-4 border border-primary/20">
                                <div className="flex items-center gap-2">
                                    <Coins className="h-4 w-4 text-amber-500 shrink-0" />
                                    <p className="text-xs text-muted-foreground">
                                        <span className="font-semibold text-foreground">{totalActiveSubs} assinatura{totalActiveSubs > 1 ? "s" : ""} ativa{totalActiveSubs > 1 ? "s" : ""}</span>
                                        {" · "}
                                        <span className="font-semibold text-foreground">{instances.length} instância{instances.length !== 1 ? "s" : ""}</span>
                                        {freeSlots > 0 && (
                                            <span className="text-green-400 font-semibold"> · {freeSlots} slot{freeSlots > 1 ? "s" : ""} livre{freeSlots > 1 ? "s" : ""}</span>
                                        )}
                                    </p>
                                </div>
                            </div>
                        )}

                        {subscriptions.length > 0 && (
                            <div className="grid gap-2 mb-4 sm:grid-cols-2 xl:grid-cols-3">
                                {subscriptions.map((sub: any, index: number) => {
                                    const active = new Date(sub.expires_at) > new Date();
                                    const days = getDaysRemaining(sub.expires_at);
                                    return (
                                        <div key={sub.id} className="glass rounded-xl p-3 border border-primary/15">
                                            <div className="flex items-center justify-between gap-2 mb-2">
                                                <p className="text-xs font-semibold text-foreground">Assinatura #{index + 1}</p>
                                                <Badge variant="secondary" className={active ? "bg-green-500/20 text-green-400 text-[10px]" : "bg-red-500/20 text-red-400 text-[10px]"}>
                                                    {active ? "Ativa" : "Expirada"}
                                                </Badge>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                                                <span>Assinada há <b className="text-foreground">{getSignedDays(sub.created_at)} dia{getSignedDays(sub.created_at) !== 1 ? "s" : ""}</b></span>
                                                <span>Expira em <b className="text-foreground">{formatDateBR(sub.expires_at)}</b></span>
                                                <span>Restam <b className="text-foreground">{days !== null ? Math.max(0, days) : "—"} dia{days === 1 ? "" : "s"}</b></span>
                                                <span>{sub.is_free ? "Slot livre" : "Slot em uso"}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {instances.length === 0 ? (
                            /* No instance yet */
                            <div className="flex flex-col items-center py-8 text-center">
                                <div className="h-16 w-16 rounded-full bg-primary/5 flex items-center justify-center mb-4">
                                    <WifiOff className="h-8 w-8 text-muted-foreground/40" />
                                </div>
                                <p className="text-foreground font-medium">Nenhuma instância configurada</p>
                                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                                    {freeSlots > 0
                                        ? "Você tem um slot de assinatura disponível! Crie uma instância sem custo."
                                        : "Crie sua instância do WhatsApp para começar a enviar mensagens de rastreio."}
                                </p>

                                {freeSlots === 0 && (
                                    <div className="glass rounded-xl px-5 py-3 mt-4 flex items-center gap-3">
                                        <Coins className="h-5 w-5 text-amber-500" />
                                        <div className="text-left">
                                            <p className="text-sm font-semibold text-foreground">{whatsappPrice} moedas/mês</p>
                                            <p className="text-[10px] text-muted-foreground">Será debitado ao criar a instância.</p>
                                        </div>
                                    </div>
                                )}

                                {freeSlots === 0 && !canAfford && (
                                    <p className="text-xs text-red-400 mt-3 flex items-center gap-1">
                                        <AlertCircle className="h-3 w-3" />
                                        Saldo insuficiente. Você tem {Number(creditos ?? 0).toFixed(2)} moedas.
                                    </p>
                                )}

                                <Button
                                    className="shimmer-btn mt-5"
                                    onClick={() => createInstanceMutation.mutate()}
                                    disabled={createInstanceMutation.isPending || (freeSlots === 0 && !canAfford)}
                                >
                                    {createInstanceMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    <Plug className="h-4 w-4 mr-1.5" />
                                    {freeSlots > 0 ? "Criar Instância (Slot Disponível)" : `Criar Instância (${whatsappPrice} moedas)`}
                                </Button>
                            </div>
                        ) : (
                            /* List of instances */
                            <div className="space-y-3">
                                {connectedInstances.length > 1 && (
                                    <div className="glass rounded-xl p-3 flex items-center gap-2 border border-primary/20">
                                        <RotateCcw className="h-4 w-4 text-primary shrink-0" />
                                        <p className="text-xs text-muted-foreground">
                                            <span className="font-semibold text-primary">{connectedInstances.length} instâncias ativas</span> — O envio em massa fará rotação automática entre elas.
                                        </p>
                                    </div>
                                )}

                                {instances.map((inst) => {
                                    const instExpired = inst.expires_at ? new Date(inst.expires_at) < new Date() : true;
                                    const instDays = getDaysRemaining(inst.expires_at ?? null);
                                    const instStatusColor = inst.status === "connected" ? "text-green-500" : inst.status === "connecting" ? "text-yellow-500" : "text-red-400";
                                    const instStatusLabel = inst.status === "connected" ? "Conectado" : inst.status === "connecting" ? "Conectando..." : "Desconectado";

                                    return (
                                        <div key={inst.id} className="glass glow-border-hover rounded-xl p-4 space-y-3">
                                            {/* Status bar */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={`h-3 w-3 rounded-full ${inst.status === "connected" ? "bg-green-500 animate-pulse" : inst.status === "connecting" ? "bg-yellow-500 animate-pulse" : "bg-red-400"}`} />
                                                    <div>
                                                        {editingLabelId === inst.id ? (
                                                            <div className="flex items-center gap-1.5">
                                                                <Input
                                                                    value={editingLabelValue}
                                                                    onChange={(e) => setEditingLabelValue(e.target.value)}
                                                                    className="h-7 w-40 text-xs bg-transparent border-border/50"
                                                                    placeholder="Ex: Loja SP, Suporte..."
                                                                    autoFocus
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === "Enter") saveLabelMutation.mutate({ id: inst.id, label: editingLabelValue });
                                                                        if (e.key === "Escape") setEditingLabelId(null);
                                                                    }}
                                                                />
                                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => saveLabelMutation.mutate({ id: inst.id, label: editingLabelValue })} disabled={saveLabelMutation.isPending}>
                                                                    {saveLabelMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 text-green-500" />}
                                                                </Button>
                                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingLabelId(null)}>
                                                                    <X className="h-3 w-3 text-muted-foreground" />
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5">
                                                                <p className="text-sm font-semibold text-foreground">{(inst as any).label || inst.instance_name}</p>
                                                                <Button variant="ghost" size="icon" className="h-5 w-5 opacity-50 hover:opacity-100" onClick={() => { setEditingLabelId(inst.id); setEditingLabelValue((inst as any).label || ""); }}>
                                                                    <Pencil className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                        {!(editingLabelId === inst.id) && (inst as any).label && (
                                                            <p className="text-[10px] text-muted-foreground font-mono">{inst.instance_name}</p>
                                                        )}
                                                        <p className={`text-xs font-medium ${instStatusColor}`}>{instStatusLabel}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <SubscriptionBadge expiresAt={inst.expires_at} />
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() => refreshStatusMutation.mutate(inst.id)}
                                                        disabled={refreshStatusMutation.isPending}
                                                    >
                                                        <RefreshCw className={`h-4 w-4 ${refreshStatusMutation.isPending ? "animate-spin" : ""}`} />
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Expired banner */}
                                            {instExpired && (
                                                <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                                    <p className="text-xs text-red-400">Assinatura expirada. Renove para enviar mensagens.</p>
                                                    <Button size="sm" className="shimmer-btn h-7 text-xs" onClick={() => renewMutation.mutate(inst.id)} disabled={renewMutation.isPending || !canAfford}>
                                                        {renewMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                                                        Renovar ({whatsappPrice})
                                                    </Button>
                                                </div>
                                            )}

                                            {!instExpired && instDays !== null && instDays <= 5 && (
                                                <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                                                    <p className="text-xs text-yellow-500">Expira em {instDays} dia{instDays > 1 ? "s" : ""}.</p>
                                                    <Button size="sm" variant="outline" className="h-7 text-xs glass border-yellow-500/30 text-yellow-500" onClick={() => renewMutation.mutate(inst.id)} disabled={renewMutation.isPending || !canAfford}>
                                                        Renovar ({whatsappPrice})
                                                    </Button>
                                                </div>
                                            )}

                                            {/* Connect section */}
                                            {inst.status === "disconnected" && (
                                                <div className="space-y-2">
                                                    <div className="flex gap-2">
                                                        <Input
                                                            placeholder="5511999999999 (opcional)"
                                                            value={phoneInput}
                                                            onChange={(e) => setPhoneInput(e.target.value)}
                                                            className="flex-1 bg-transparent border-border/50 h-8 text-xs"
                                                        />
                                                        <Button size="sm" className="shimmer-btn h-8 text-xs" onClick={() => connectMutation.mutate(inst.id)} disabled={connectMutation.isPending}>
                                                            {connectMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                                                            <QrCode className="h-3 w-3 mr-1" />
                                                            {phoneInput ? "Código" : "QR Code"}
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}

                                            {(inst.status === "connecting" || (connectData?.instanceId === inst.id)) && (
                                                <div className="space-y-3">
                                                    <p className="text-xs text-yellow-500 flex items-center gap-1.5">
                                                        <Loader2 className="h-3 w-3 animate-spin" /> Aguardando conexão...
                                                    </p>
                                                    {(() => {
                                                        const qr = (connectData?.instanceId === inst.id && connectData?.qrCode) || inst.qr_code;
                                                        const pairing = (connectData?.instanceId === inst.id && connectData?.pairingCode) || inst.pairing_code;
                                                        return (
                                                            <>
                                                                {qr && (
                                                                    <div className="flex flex-col items-center gap-2">
                                                                        <div className="p-3 bg-white rounded-xl">
                                                                            <img
                                                                                src={qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`}
                                                                                alt="QR Code"
                                                                                className="w-48 h-48 object-contain"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {pairing && (
                                                                    <code className="text-xl font-mono font-bold text-primary bg-primary/10 px-4 py-2 rounded-xl tracking-[0.3em] block text-center">
                                                                        {pairing}
                                                                    </code>
                                                                )}
                                                                {!qr && !pairing && (
                                                                    <div className="flex flex-col items-center gap-2">
                                                                        <p className="text-xs text-muted-foreground">Nenhum QR Code disponível. Tente reconectar.</p>
                                                                        <Button size="sm" className="shimmer-btn h-8 text-xs" onClick={() => connectMutation.mutate(inst.id)} disabled={connectMutation.isPending}>
                                                                            {connectMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                                                                            <QrCode className="h-3 w-3 mr-1" />
                                                                            Reconectar
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            )}

                                            {inst.status === "connected" && (
                                                <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/5">
                                                    <Wifi className="h-4 w-4 text-green-500" />
                                                    <p className="text-xs text-muted-foreground">
                                                        Pronta para enviar.{inst.phone && ` Tel: ${inst.phone}`}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Action buttons */}
                                            <div className="flex gap-2">
                                                {inst.status === "connected" && (
                                                    <Button variant="outline" size="sm" className="glass border-yellow-500/30 text-yellow-500 h-7 text-xs" onClick={() => disconnectMutation.mutate(inst.id)} disabled={disconnectMutation.isPending}>
                                                        <Power className="h-3 w-3 mr-1" /> Desconectar
                                                    </Button>
                                                )}
                                                <Button variant="outline" size="sm" className="glass border-red-500/30 text-red-500 h-7 text-xs" onClick={() => {
                                                    if (confirm("Remover instância?\n\nSua assinatura continuará ativa e você poderá criar uma nova instância sem custo adicional.")) deleteMutation.mutate(inst.id);
                                                }} disabled={deleteMutation.isPending}>
                                                    <Trash2 className="h-3 w-3 mr-1" /> Remover
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
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

                        {/* Image URL */}
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">URL da Imagem (opcional)</label>
                            <Input
                                value={imageUrl}
                                onChange={(e) => setImageUrl(e.target.value)}
                                className="bg-transparent border-border/50"
                                placeholder="https://exemplo.com/imagem.jpg"
                            />
                            <p className="text-[10px] text-muted-foreground mt-1">A imagem será enviada junto com a mensagem.</p>
                        </div>

                        {/* Template textarea */}
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Mensagem</label>
                            <Textarea
                                value={msgTemplate}
                                onChange={(e) => setMsgTemplate(e.target.value)}
                                className="min-h-[200px] bg-transparent border-border/50 font-mono text-sm"
                                placeholder="Digite sua mensagem com variáveis..."
                            />
                        </div>

                        {/* Button text */}
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Texto do Botão de Rastreio</label>
                            <Input value={btnText} onChange={(e) => setBtnText(e.target.value)} className="bg-transparent border-border/50" placeholder="📦 Rastrear Pedido" />
                        </div>

                        {/* 2nd URL button (optional) */}
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Texto do 2º Botão URL (opcional)</label>
                            <Input value={btn2Text} onChange={(e) => setBtn2Text(e.target.value)} className="bg-transparent border-border/50" placeholder="💬 Falar com Suporte" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">URL do 2º Botão (opcional)</label>
                            <Input value={btn2Url} onChange={(e) => setBtn2Url(e.target.value)} className="bg-transparent border-border/50" placeholder="https://wa.me/5511999999999" />
                            <p className="text-[10px] text-muted-foreground mt-1">Ex: link do suporte, site, ou qualquer URL.</p>
                        </div>

                        {/* Reply button */}
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Texto do Botão de Resposta Rápida</label>
                            <Input value={replyText} onChange={(e) => setReplyText(e.target.value)} className="bg-transparent border-border/50" placeholder="Quero acompanhar meu pedido" />
                            <p className="text-[10px] text-muted-foreground mt-1">O cliente clica e envia essa mensagem como resposta automática.</p>
                        </div>

                        {/* Footer */}
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Texto do Rodapé (opcional)</label>
                            <Input value={footerText} onChange={(e) => setFooterText(e.target.value)} className="bg-transparent border-border/50" placeholder="Obrigado pela sua compra!" />
                        </div>

                        <Button className="shimmer-btn w-full" onClick={() => saveTemplateMutation.mutate()} disabled={saveTemplateMutation.isPending}>
                            {saveTemplateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Salvar Template
                        </Button>
                    </div>

                    {/* Preview - Phone mockup */}
                    <div className="glass glow-border rounded-xl p-6 space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2.5 rounded-xl bg-green-500/10">
                                <Eye className="h-5 w-5 text-green-500" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-foreground">Pré-visualização</h2>
                                <p className="text-xs text-muted-foreground">Veja como a mensagem será exibida no WhatsApp.</p>
                            </div>
                        </div>

                        {/* Phone frame */}
                        <div className="flex justify-center">
                            <div className="w-[320px] rounded-[2rem] border-[3px] border-zinc-700 bg-[#0b141a] shadow-2xl overflow-hidden">
                                {/* Phone top bar */}
                                <div className="bg-[#1f2c34] px-4 py-2 flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-bold">
                                        {(previewEnvio?.cliente_nome?.[0] || "J").toUpperCase()}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-white text-sm font-medium truncate">
                                            {previewEnvio?.cliente_nome || "João Silva"}
                                        </p>
                                        <p className="text-green-400 text-[10px]">online</p>
                                    </div>
                                    <Phone className="h-4 w-4 text-zinc-400" />
                                </div>

                                {/* Chat area */}
                                <div className="bg-[#0b141a] p-3 min-h-[420px] flex flex-col justify-end">
                                    <div className="max-w-[92%] ml-auto">
                                        <div className="bg-[#005c4b] rounded-xl rounded-tr-sm shadow-lg overflow-hidden">
                                            {/* Image preview */}
                                            {imageUrl && (
                                                <div className="w-full aspect-video bg-zinc-800 flex items-center justify-center overflow-hidden">
                                                    <img
                                                        src={imageUrl}
                                                        alt="Preview"
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).style.display = "none";
                                                        }}
                                                    />
                                                </div>
                                            )}
                                            <div className="p-3">
                                                <p className="text-sm text-white whitespace-pre-wrap leading-relaxed"
                                                    dangerouslySetInnerHTML={{
                                                        __html: DOMPurify.sanitize(formatWhatsAppText(
                                                            previewEnvio
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
                                                                })
                                                        )),
                                                    }}
                                                />
                                                {footerText && <p className="text-[10px] text-white/40 mt-2">{footerText}</p>}
                                                <p className="text-[10px] text-white/30 text-right mt-1">
                                                    {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                                </p>
                                            </div>
                                            {/* Buttons area - inside bubble */}
                                            <div className="border-t border-white/10">
                                                <div className="flex items-center justify-center gap-1.5 py-2 cursor-pointer hover:bg-white/5">
                                                    <span className="text-[#53bdeb] text-sm">🔗</span>
                                                    <span className="text-[#53bdeb] text-sm font-medium">{btnText}</span>
                                                </div>
                                            </div>
                                            {btn2Text && btn2Url && (
                                                <div className="border-t border-white/10">
                                                    <div className="flex items-center justify-center gap-1.5 py-2 cursor-pointer hover:bg-white/5">
                                                        <span className="text-[#53bdeb] text-sm">🔗</span>
                                                        <span className="text-[#53bdeb] text-sm font-medium">{btn2Text}</span>
                                                    </div>
                                                </div>
                                            )}
                                            {replyText && (
                                                <div className="border-t border-white/10">
                                                    <div className="flex items-center justify-center gap-1.5 py-2 cursor-pointer hover:bg-white/5">
                                                        <Reply className="h-3.5 w-3.5 text-[#53bdeb]" />
                                                        <span className="text-[#53bdeb] text-sm font-medium">{replyText}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Phone bottom bar */}
                                <div className="bg-[#1f2c34] px-3 py-2 flex items-center gap-2">
                                    <div className="flex-1 bg-[#2a3942] rounded-full px-4 py-1.5">
                                        <p className="text-zinc-500 text-xs">Mensagem</p>
                                    </div>
                                    <div className="h-8 w-8 rounded-full bg-green-600 flex items-center justify-center">
                                        <Send className="h-3.5 w-3.5 text-white" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {envios.length > 0 && (
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Selecione um envio para visualizar com dados reais</label>
                                <Select value={previewEnvio?.id || ""} onValueChange={(val) => { const envio = envios.find((e) => e.id === val); if (envio) setPreviewEnvio(envio); }}>
                                    <SelectTrigger className="bg-transparent border-border/50"><SelectValue placeholder="Escolher envio..." /></SelectTrigger>
                                    <SelectContent>
                                        {envios.slice(0, 20).map((e) => (
                                            <SelectItem key={e.id} value={e.id}>{e.cliente_nome} — {formatProduto(e.produto)}</SelectItem>
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
                    {connectedInstances.length === 0 && (
                        <div className="glass rounded-xl p-4 flex items-center gap-3 border border-yellow-500/30">
                            <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0" />
                            <p className="text-sm text-yellow-500">
                                Nenhuma instância WhatsApp conectada. Vá para a aba "Instância" para conectar.
                            </p>
                        </div>
                    )}

                    {/* Warning if all subscriptions expired */}
                    {instances.length > 0 && connectedInstances.length === 0 && instances.some((i) => i.status === "connected") && (
                        <div className="glass rounded-xl p-4 flex items-center justify-between gap-3 border border-red-500/30 flex-wrap">
                            <div className="flex items-center gap-3">
                                <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
                                <p className="text-sm text-red-400">Assinaturas expiradas. Renove para enviar mensagens.</p>
                            </div>
                        </div>
                    )}

                    {/* Instance selector — checkbox cards */}
                    {connectedInstances.length > 0 && (
                        <div className="glass glow-border rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-primary/10">
                                        <Wifi className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-foreground">Instâncias de Envio</p>
                                        <p className="text-[10px] text-muted-foreground">
                                            Selecione as instâncias que serão usadas. Múltiplas = rotação automática.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-1.5">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-[10px] px-2"
                                        onClick={() => setSelectedInstanceIds(new Set(connectedInstances.map((i) => i.id)))}
                                    >
                                        Todas
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-[10px] px-2"
                                        onClick={() => setSelectedInstanceIds(new Set())}
                                    >
                                        Nenhuma
                                    </Button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {connectedInstances.map((inst) => {
                                    const isSelected = selectedInstanceIds.has(inst.id);
                                    return (
                                        <div
                                            key={inst.id}
                                            onClick={() => {
                                                setSelectedInstanceIds((prev) => {
                                                    const next = new Set(prev);
                                                    next.has(inst.id) ? next.delete(inst.id) : next.add(inst.id);
                                                    return next;
                                                });
                                            }}
                                            className={`cursor-pointer rounded-lg p-3 border transition-all duration-200 ${
                                                isSelected
                                                    ? "border-primary bg-primary/10 shadow-sm shadow-primary/10"
                                                    : "border-border/30 bg-transparent hover:border-border/60"
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <Checkbox
                                                    checked={isSelected}
                                                    className="h-4 w-4 border-primary/30 pointer-events-none"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold text-foreground truncate">
                                                        {(inst as any).label || inst.instance_name}
                                                    </p>
                                                    {inst.phone && (
                                                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                            <Phone className="h-2.5 w-2.5" />
                                                            {inst.phone}
                                                        </p>
                                                    )}
                                                </div>
                                                <span className="inline-block h-2 w-2 rounded-full bg-green-500 shrink-0" />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {selectedInstanceIds.size > 1 && (
                                <div className="flex items-center gap-2 pt-1">
                                    <RotateCcw className="h-3 w-3 text-primary" />
                                    <span className="text-[10px] text-muted-foreground">
                                        Rotação automática entre {selectedInstanceIds.size} instâncias selecionadas.
                                    </span>
                                </div>
                            )}
                            {selectedInstanceIds.size === 0 && (
                                <p className="text-[10px] text-yellow-500 flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" /> Selecione ao menos uma instância para enviar.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Auto-send config */}
                    <div className="glass glow-border rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-primary/10">
                                    <Zap className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-foreground">Envio Automático</p>
                                    <p className="text-[10px] text-muted-foreground">
                                        Novos leads receberão a mensagem automaticamente.
                                    </p>
                                </div>
                            </div>
                            <Switch
                                checked={autoSend}
                                onCheckedChange={(checked) => {
                                    setAutoSend(checked);
                                    saveAutoSendMutation.mutate({ auto: checked, delay: delayMinutes });
                                }}
                            />
                        </div>

                        {autoSend && (
                            <div className="flex items-center gap-3 pl-11">
                                <label className="text-xs text-muted-foreground whitespace-nowrap">Delay entre envios:</label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={60}
                                    value={delayMinutes}
                                    onChange={(e) => setDelayMinutes(Number(e.target.value) || 5)}
                                    onBlur={() => saveAutoSendMutation.mutate({ auto: autoSend, delay: delayMinutes })}
                                    className="w-20 h-7 text-xs bg-transparent border-border/50 text-center"
                                />
                                <span className="text-xs text-muted-foreground">minutos</span>
                                <span className="text-[10px] text-muted-foreground/60">(recomendado: 5 min)</span>
                            </div>
                        )}

                        {connectedInstances.length > 1 && (
                            <div className="flex items-center gap-2 pl-11">
                                <RotateCcw className="h-3 w-3 text-primary" />
                                <span className="text-[10px] text-muted-foreground">
                                    Rotação ativa: {connectedInstances.length} instâncias alternando envios.
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Sub-tabs: Pendentes / Enviados */}
                    <div className="glass-strong glow-border rounded-xl p-3 space-y-3">
                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Button
                                    variant={sendSubTab === "pendentes" ? "default" : "ghost"}
                                    size="sm"
                                    className="h-8 text-xs gap-1.5"
                                    onClick={() => { setSendSubTab("pendentes"); setSelectedIds(new Set()); }}
                                >
                                    <Clock className="h-3.5 w-3.5" />
                                    Pendentes
                                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] bg-yellow-500/20 text-yellow-500">
                                        {pendentesCount}
                                    </Badge>
                                </Button>
                                <Button
                                    variant={sendSubTab === "enviados" ? "default" : "ghost"}
                                    size="sm"
                                    className="h-8 text-xs gap-1.5"
                                    onClick={() => { setSendSubTab("enviados"); setSelectedIds(new Set()); }}
                                >
                                    <Check className="h-3.5 w-3.5" />
                                    Enviados
                                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] bg-green-500/20 text-green-500">
                                        {enviadosCount}
                                    </Badge>
                                </Button>
                                {sendSubTab === "enviados" && failedSaldoCount > 0 && (
                                    <Button
                                        size="sm"
                                        variant="default"
                                        className="h-8 text-xs gap-1.5"
                                        onClick={handleRetryFailed}
                                        disabled={retryingFailed}
                                    >
                                        {retryingFailed ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                        Reenviar {failedSaldoCount} {failedSaldoCount === 1 ? "falha" : "falhas"} de saldo
                                    </Button>
                                )}
                            </div>

                            <div className="flex gap-2 items-center w-full sm:w-auto">
                                {sendSubTab === "pendentes" && nextScheduled && autoSend && (() => {
                                    const remaining = Math.max(0, new Date(nextScheduled).getTime() - nowTick);
                                    const totalSec = Math.ceil(remaining / 1000);
                                    const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
                                    const ss = String(totalSec % 60).padStart(2, "0");
                                    const isReady = remaining <= 0;
                                    return (
                                        <div className={`flex items-center gap-3 rounded-lg px-4 py-2 border transition-colors ${isReady ? "bg-green-500/10 border-green-500/40" : "bg-yellow-500/5 border-yellow-500/30"}`}>
                                            <Clock className={`h-5 w-5 ${isReady ? "text-green-500 animate-pulse" : "text-yellow-500"}`} />
                                            <div className="flex flex-col leading-tight">
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Próximo envio</span>
                                                <span className={`text-lg font-bold tabular-nums ${isReady ? "text-green-500" : "text-foreground"}`}>
                                                    {isReady ? "Enviando..." : `${mm}:${ss}`}
                                                </span>
                                                {nextClienteNome && (
                                                    <span className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                                                        {nextClienteNome}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {sendSubTab === "pendentes" && (
                                    <div className="flex items-center gap-2 glass rounded-lg px-3 py-1.5">
                                        <Checkbox
                                            checked={filteredEnvios.length > 0 && selectedIds.size === filteredEnvios.length}
                                            onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                            className="h-4 w-4 border-primary/30"
                                        />
                                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Tudo</span>
                                    </div>
                                )}

                                {sendSubTab === "pendentes" && selectedIds.size > 0 && (
                                    <Button
                                        size="sm"
                                        className="shimmer-btn h-8 text-xs"
                                        onClick={handleSendSelected}
                                        disabled={connectedInstances.length === 0 || sendingIds.size > 0 || selectedInstanceIds.size === 0}
                                    >
                                        {sendingIds.size > 0 ? (
                                            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                        ) : (
                                            <Send className="h-3.5 w-3.5 mr-1" />
                                        )}
                                        Enviar ({selectedIds.size})
                                        {selectedInstanceIds.size > 1 && (
                                            <span className="ml-1 text-[9px] opacity-70">🔄 {selectedInstanceIds.size}x rotação</span>
                                        )}
                                    </Button>
                                )}

                                <div className="relative flex-1 sm:w-56">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar nome, produto..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="pl-8 h-8 text-xs bg-transparent border-border/50"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Envio list */}
                    {filteredEnvios.length === 0 ? (
                        <div className="flex flex-col items-center py-16 text-center">
                            <div className="h-16 w-16 rounded-full bg-primary/5 flex items-center justify-center mb-4">
                                {sendSubTab === "pendentes" ? (
                                    <Clock className="h-8 w-8 text-muted-foreground/30" />
                                ) : (
                                    <Check className="h-8 w-8 text-muted-foreground/30" />
                                )}
                            </div>
                            <p className="text-foreground font-medium">
                                {sendSubTab === "pendentes" ? "Nenhum envio pendente" : "Nenhum envio enviado"}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                                {sendSubTab === "pendentes"
                                    ? "Todos os envios já foram enviados via WhatsApp ou adicione novos na aba \"Envios\"."
                                    : "Envie mensagens na aba \"Pendentes\" para vê-las aqui."}
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1.5">
                            {visibleEnvios.map((envio, idx) => {
                                const isSending = sendingIds.has(envio.id);
                                const isFailed = failedEnvioIds.has(envio.id) || failedIds.has(envio.id);
                                const hasPhone = !!envio.cliente_telefone;
                                const anyInstanceReady = connectedInstances.length > 0;
                                const logEntry = messageLogMap[envio.id];
                                const entryTime = envio.created_at ? new Date(envio.created_at) : null;
                                const actionTime = logEntry?.created_at ? new Date(logEntry.created_at) : null;

                                const formatTime = (d: Date) => {
                                    const day = String(d.getDate()).padStart(2, "0");
                                    const mon = String(d.getMonth() + 1).padStart(2, "0");
                                    const h = String(d.getHours()).padStart(2, "0");
                                    const m = String(d.getMinutes()).padStart(2, "0");
                                    return `${day}/${mon} ${h}:${m}`;
                                };

                                return (
                                    <div
                                        key={envio.id}
                                        className="glass glow-border-hover rounded-lg px-3 py-2.5 transition-all duration-200 hover:bg-primary/5 animate-stagger-in group"
                                        style={{ animationDelay: `${idx * 0.02}s` }}
                                    >
                                        <div className="flex items-center gap-3 flex-wrap md:flex-nowrap">
                                            {/* Checkbox only in Pendentes */}
                                            {sendSubTab === "pendentes" && (
                                                <Checkbox
                                                    checked={selectedIds.has(envio.id)}
                                                    onCheckedChange={() => toggleSelect(envio.id)}
                                                    className="h-4 w-4 border-primary/30 shrink-0"
                                                />
                                            )}

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

                                            {/* Timestamps */}
                                            <div className="hidden xl:flex flex-col items-end gap-0.5 shrink-0 min-w-[100px]">
                                                {entryTime && (
                                                    <span className="text-[9px] text-muted-foreground flex items-center gap-1" title="Entrou no painel">
                                                        <Clock className="h-2.5 w-2.5" /> {formatTime(entryTime)}
                                                    </span>
                                                )}
                                                {actionTime && (
                                                    <span className={`text-[9px] flex items-center gap-1 ${logEntry?.status === "sent" ? "text-green-500" : "text-red-400"}`} title={logEntry?.status === "sent" ? "Enviado em" : "Falhou em"}>
                                                        {logEntry?.status === "sent" ? <Check className="h-2.5 w-2.5" /> : <AlertCircle className="h-2.5 w-2.5" />}
                                                        {formatTime(actionTime)}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Status / Actions */}
                                            <div className="flex items-center gap-1.5 ml-auto shrink-0">
                                                {sendSubTab === "enviados" && logEntry?.status === "sent" && (
                                                    <>
                                                        {(logEntry as any)?.instance_label && (
                                                            <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px] px-2 py-0 h-5 whitespace-nowrap">
                                                                <Smartphone className="h-3 w-3 mr-1 shrink-0" />
                                                                <span>{(logEntry as any).instance_label}</span>
                                                            </Badge>
                                                        )}
                                                        <Badge variant="secondary" className="bg-green-500/20 text-green-500 text-[9px] px-1.5 py-0 h-5">
                                                            <Check className="h-3 w-3 mr-0.5" /> Enviado
                                                        </Badge>
                                                    </>
                                                )}

                                                {sendSubTab === "enviados" && logEntry?.status === "failed" && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Badge variant="secondary" className="bg-red-500/20 text-red-400 text-[9px] px-1.5 py-0 h-5 cursor-help">
                                                                <AlertCircle className="h-3 w-3 mr-0.5" /> Falhou
                                                            </Badge>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="left" className="max-w-[300px] text-xs">
                                                            <p className="font-medium mb-1">Motivo da falha:</p>
                                                            <p>{(logEntry as any)?.error_reason || "Falha no envio da mensagem via UAZAPI"}</p>
                                                            {actionTime && <p className="mt-1 text-muted-foreground">Falhou em: {formatTime(actionTime)}</p>}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                )}

                                                {sendSubTab === "pendentes" && isFailed && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span className="inline-flex items-center gap-1 text-[9px] text-red-400 cursor-help">
                                                                <AlertCircle className="h-3 w-3" />
                                                                <span className="hidden sm:inline max-w-[120px] truncate">
                                                                    {failReasons[envio.id] || "Falha no envio"}
                                                                </span>
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="left" className="max-w-[300px] text-xs">
                                                            <p className="font-medium mb-1">Motivo da falha:</p>
                                                            <p>{failReasons[envio.id] || (logEntry as any)?.error_reason || "Falha no envio da mensagem via UAZAPI"}</p>
                                                            {actionTime && <p className="mt-1 text-muted-foreground">Falhou em: {formatTime(actionTime)}</p>}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                )}

                                                {sendSubTab === "pendentes" && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 hover:bg-green-500/10"
                                                        onClick={() => sendMessage(envio)}
                                                        disabled={isSending || !anyInstanceReady || selectedInstanceIds.size === 0}
                                                        title={!anyInstanceReady ? "Nenhuma instância ativa" : "Enviar mensagem"}
                                                    >
                                                        {isSending ? (
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin text-green-500" />
                                                        ) : (
                                                            <Send className="h-3.5 w-3.5 text-green-500" />
                                                        )}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {sendSubTab === "pendentes" && filteredEnvios.length > PENDENTES_PER_PAGE && (
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/30">
                            <p className="text-[11px] text-muted-foreground">
                                Mostrando {(currentPendentesPage - 1) * PENDENTES_PER_PAGE + 1}–{Math.min(currentPendentesPage * PENDENTES_PER_PAGE, filteredEnvios.length)} de {filteredEnvios.length}
                            </p>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => setPendentesPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPendentesPage === 1}
                                >
                                    Anterior
                                </Button>
                                <span className="text-[11px] text-muted-foreground px-2">
                                    {currentPendentesPage} / {totalPendentesPages}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => setPendentesPage((p) => Math.min(totalPendentesPages, p + 1))}
                                    disabled={currentPendentesPage === totalPendentesPages}
                                >
                                    Próxima
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
