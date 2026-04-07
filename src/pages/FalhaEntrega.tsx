import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    Search,
    ShieldCheck,
    CreditCard,
    Package,
    Loader2,
    Calendar,
    DollarSign,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { triggerNextEmail } from "@/lib/email-trigger";

/* ─── Types ─── */
interface FalhaEntregaEnvio {
    id: string;
    cliente_nome: string;
    cliente_email: string;
    produto: string;
    codigo_rastreio: string | null;
    valor: number;
    status: string;
    ultimo_evento_ordem: number;
    created_at: string;
    updated_at: string;
    falha_status: "pendente" | "aprovado";
}

import { formatProduto } from "@/lib/format-produto";

/* ─── Component ─── */
export default function FalhaEntrega() {
    const [search, setSearch] = useState("");
    const [tab, setTab] = useState("pendentes");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
    const queryClient = useQueryClient();
    const { loja } = useLoja();

    const { data: falhaEventos } = useQuery({
        queryKey: ["falha-eventos", loja?.id],
        queryFn: async () => {
            if (!loja) return null;
            const { data: config } = await supabase
                .from("postagem_config")
                .select("template_ativo_id, valor_taxa_falha")
                .eq("loja_id", loja.id)
                .maybeSingle();
            if (!config?.template_ativo_id) return null;
            const { data: eventos } = await supabase
                .from("postagem_eventos")
                .select("id, nome, ordem, status_label")
                .eq("template_id", config.template_ativo_id)
                .in("status_label", ["Falha Entrega"])
                .order("ordem", { ascending: true });
            if (!eventos || eventos.length === 0) return null;
            const falhaEvento = eventos.find((e) => e.status_label === "Falha Entrega" || e.nome === "Falha na Entrega");
            return {
                falha_ordem: falhaEvento?.ordem ?? null,
                template_id: config.template_ativo_id,
                valor_reenvio: Number(config.valor_taxa_falha) || 0,
            };
        },
        enabled: !!loja,
    });

    const { data: envios = [], isLoading } = useQuery({
        queryKey: ["falha-envios", loja?.id, falhaEventos],
        queryFn: async () => {
            if (!loja || !falhaEventos?.falha_ordem) return [];
            const { data, error } = await supabase
                .from("envios")
                .select("*")
                .eq("loja_id", loja.id)
                .is("deleted_at", null)
                .gte("ultimo_evento_ordem", falhaEventos.falha_ordem)
                .order("updated_at", { ascending: false });
            if (error) throw error;
            return (data || []).map((envio) => {
                let falha_status: "pendente" | "aprovado" = "pendente";
                if (envio.ultimo_evento_ordem > falhaEventos.falha_ordem) {
                    falha_status = "aprovado";
                }
                return { ...envio, falha_status } as FalhaEntregaEnvio;
            });
        },
        enabled: !!loja && !!falhaEventos?.falha_ordem,
    });

    const approveMutation = useMutation({
        mutationFn: async (envioId: string) => {
            if (!loja?.id) throw new Error("Loja não encontrada");
            const result = await triggerNextEmail(envioId, loja.id, true);
            if (!result) throw new Error("Erro ao avançar o fluxo");
            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["falha-envios"] });
            queryClient.invalidateQueries({ queryKey: ["envios"] });
            toast.success("Pagamento aprovado! Fluxo avançado com sucesso.");
        },
        onError: (err: Error) => {
            toast.error(err.message || "Erro ao aprovar pagamento");
        },
    });

    const bulkApproveMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            if (!loja?.id) throw new Error("Loja não encontrada");
            const results: { id: string; ok: boolean }[] = [];
            for (let i = 0; i < ids.length; i++) {
                setBulkProgress({ current: i + 1, total: ids.length });
                try {
                    const result = await triggerNextEmail(ids[i], loja.id, true);
                    results.push({ id: ids[i], ok: !!result });
                } catch {
                    results.push({ id: ids[i], ok: false });
                }
            }
            return results;
        },
        onSuccess: (results) => {
            const ok = results.filter((r) => r.ok).length;
            const fail = results.length - ok;
            setSelectedIds(new Set());
            setBulkProgress(null);
            queryClient.invalidateQueries({ queryKey: ["falha-envios"] });
            queryClient.invalidateQueries({ queryKey: ["envios"] });
            toast.success(`${ok} pagamento(s) aprovado(s)${fail > 0 ? `, ${fail} falha(s)` : ""}`);
        },
        onError: () => {
            setBulkProgress(null);
            toast.error("Erro ao processar aprovações em massa");
        },
    });

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleTabChange = (newTab: string) => {
        setTab(newTab);
        setSelectedIds(new Set());
    };

    const pendentes = envios.filter((e) => e.falha_status === "pendente");
    const aprovados = envios.filter((e) => e.falha_status === "aprovado");
    const currentList = tab === "pendentes" ? pendentes : aprovados;
    const filteredList = currentList.filter((e) => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (
            e.cliente_nome.toLowerCase().includes(s) ||
            e.cliente_email.toLowerCase().includes(s) ||
            e.produto.toLowerCase().includes(s) ||
            (e.codigo_rastreio && e.codigo_rastreio.toLowerCase().includes(s))
        );
    });

    const totalPendentes = pendentes.length;
    const totalAprovados = aprovados.length;
    const valorReenvio = falhaEventos?.valor_reenvio || 0;
    const totalValorPendente = totalPendentes * valorReenvio;

    const metrics = [
        { label: "Pendentes", value: String(totalPendentes), icon: Clock, delay: 0 },
        { label: "Aprovados", value: String(totalAprovados), icon: CheckCircle2, delay: 0.08 },
        { label: "Valor Pendente", value: `R$ ${totalValorPendente.toFixed(2)}`, icon: DollarSign, delay: 0.16 },
    ];

    // No falha events configured
    if (!isLoading && !falhaEventos?.falha_ordem) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Falha na Entrega</h1>
                    <p className="text-sm text-muted-foreground mt-1">Gerencie os pagamentos de reenvio.</p>
                </div>
                <div className="glass glow-border rounded-xl flex flex-col items-center justify-center py-20 text-center">
                    <div className="relative mb-5">
                        <div className="h-16 w-16 rounded-full bg-primary/5 flex items-center justify-center">
                            <AlertTriangle className="h-8 w-8 text-primary/30" />
                        </div>
                        <div className="absolute inset-0 animate-orbit">
                            <div className="h-2 w-2 rounded-full bg-primary/30 animate-pulse-dot" />
                        </div>
                    </div>
                    <p className="text-foreground font-medium text-lg">Evento não configurado</p>
                    <p className="text-sm text-muted-foreground mt-1 max-w-md">
                        Configure o evento de "Falha na Entrega" no seu template de postagens para habilitar a gestão de pagamentos.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Hero + Metrics */}
            <div className="space-y-5">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Falha na Entrega</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Gerencie os pagamentos de reenvio por falha na entrega.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {metrics.map((m) => (
                        <div
                            key={m.label}
                            className="glass glow-border rounded-xl p-4 animate-stagger-in"
                            style={{ animationDelay: `${m.delay}s` }}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{m.label}</p>
                                    <p className="text-2xl font-bold text-foreground mt-1">{m.value}</p>
                                </div>
                                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                    <m.icon className="h-5 w-5 text-primary" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Action Bar */}
            <div className="glass-strong glow-border rounded-xl p-3">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                    <Tabs value={tab} onValueChange={setTab} className="w-auto">
                        <TabsList className="glass h-8">
                            <TabsTrigger value="pendentes" className="text-xs gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary h-7">
                                <Clock className="h-3 w-3" />
                                Pendentes
                                {totalPendentes > 0 && (
                                    <span className="ml-0.5 bg-destructive/80 text-destructive-foreground text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                                        {totalPendentes}
                                    </span>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="aprovados" className="text-xs gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary h-7">
                                <CheckCircle2 className="h-3 w-3" />
                                Aprovados
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Buscar cliente, produto..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8 h-8 text-xs bg-transparent border-border/50"
                        />
                    </div>
                </div>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-6 w-6 animate-spin text-primary/50" />
                </div>
            ) : filteredList.length === 0 ? (
                <div className="glass glow-border rounded-xl flex flex-col items-center justify-center py-20 text-center">
                    <div className="relative mb-4">
                        <div className="h-16 w-16 rounded-full bg-primary/5 flex items-center justify-center">
                            <ShieldCheck className="h-8 w-8 text-primary/30" />
                        </div>
                        <div className="absolute inset-0 animate-orbit">
                            <div className="h-2 w-2 rounded-full bg-primary/30 animate-pulse-dot" />
                        </div>
                    </div>
                    <p className="text-foreground font-medium">
                        {tab === "pendentes" ? "Nenhum pagamento pendente" : "Nenhum pagamento aprovado"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                        {tab === "pendentes" ? "Todos os pagamentos foram aprovados." : "Os pagamentos aprovados aparecerão aqui."}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredList.map((envio, idx) => (
                        <div
                            key={envio.id}
                            className="glass glow-border-hover rounded-xl p-4 transition-all duration-300 hover:scale-[1.02] animate-stagger-in group"
                            style={{ animationDelay: `${idx * 0.05}s` }}
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between mb-3">
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-foreground truncate">{envio.cliente_nome}</p>
                                    <p className="text-xs text-muted-foreground truncate">{envio.cliente_email}</p>
                                </div>
                                <Badge
                                    variant="secondary"
                                    className={`text-[10px] ml-2 whitespace-nowrap ${envio.falha_status === "pendente"
                                        ? "bg-primary/20 text-primary"
                                        : "bg-primary/15 text-primary"
                                        }`}
                                >
                                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-current mr-1 animate-pulse-dot" />
                                    {envio.falha_status === "pendente" ? "Pendente" : "Aprovado"}
                                </Badge>
                            </div>

                            {/* Body */}
                            <div className="space-y-2.5">
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Package className="h-3 w-3" />
                                    <span className="line-clamp-1">{formatProduto(envio.produto)}</span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-lg font-bold text-primary">R$ {valorReenvio.toFixed(2)}</span>
                                    {envio.codigo_rastreio && (
                                        <span className="font-mono text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                                            {envio.codigo_rastreio}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(envio.updated_at), "dd/MM/yyyy HH:mm")}
                                </div>
                                {envio.falha_status === "pendente" ? (
                                    <Button
                                        size="sm"
                                        className="h-7 text-xs shimmer-btn gap-1"
                                        disabled={approveMutation.isPending}
                                        onClick={() => approveMutation.mutate(envio.id)}
                                    >
                                        {approveMutation.isPending ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <ShieldCheck className="h-3 w-3" />
                                        )}
                                        Aprovar
                                    </Button>
                                ) : (
                                    <Badge variant="outline" className="text-[10px] border-primary/20 text-primary gap-1">
                                        <CheckCircle2 className="h-2.5 w-2.5" />
                                        Aprovado
                                    </Badge>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
