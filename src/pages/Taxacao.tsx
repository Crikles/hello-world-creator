import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    Search,
    ShieldCheck,
    XCircle,
    ExternalLink,
    CreditCard,
    Package,
    User,
    Loader2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { triggerNextEmail } from "@/lib/email-trigger";

/* ─── Types ─── */
interface TaxacaoEnvio {
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
    // Computed status
    taxacao_status: "pendente" | "aprovado";
}

/* ─── Component ─── */
export default function Taxacao() {
    const [search, setSearch] = useState("");
    const [tab, setTab] = useState("pendentes");
    const queryClient = useQueryClient();
    const { loja } = useLoja();

    // ── Fetch the ordem of the "Taxação" and "Pago" events ──
    const { data: taxEventos } = useQuery({
        queryKey: ["tax-eventos", loja?.id],
        queryFn: async () => {
            if (!loja) return null;

            const { data: config } = await supabase
                .from("postagem_config")
                .select("template_ativo_id")
                .eq("loja_id", loja.id)
                .maybeSingle();

            if (!config?.template_ativo_id) return null;

            const { data: eventos } = await supabase
                .from("postagem_eventos")
                .select("id, nome, ordem, status_label")
                .eq("template_id", config.template_ativo_id)
                .in("status_label", ["Taxação", "Pago"])
                .order("ordem", { ascending: true });

            if (!eventos || eventos.length === 0) return null;

            const taxEvento = eventos.find((e) => e.status_label === "Taxação");
            const pagoEvento = eventos.find((e) => e.status_label === "Pago");

            return {
                taxacao_ordem: taxEvento?.ordem ?? null,
                pago_ordem: pagoEvento?.ordem ?? null,
                template_id: config.template_ativo_id,
            };
        },
        enabled: !!loja,
    });

    // ── Fetch all envios that reached Taxação or beyond ──
    const { data: envios = [], isLoading } = useQuery({
        queryKey: ["taxacao-envios", loja?.id, taxEventos],
        queryFn: async () => {
            if (!loja || !taxEventos?.taxacao_ordem) return [];

            const { data, error } = await supabase
                .from("envios")
                .select("*")
                .eq("loja_id", loja.id)
                .gte("ultimo_evento_ordem", taxEventos.taxacao_ordem)
                .order("updated_at", { ascending: false });

            if (error) throw error;

            return (data || []).map((envio) => {
                let taxacao_status: "pendente" | "aprovado" = "pendente";

                // If the envio has moved past Taxação (to Pago or beyond), it's approved
                if (
                    taxEventos.pago_ordem &&
                    envio.ultimo_evento_ordem >= taxEventos.pago_ordem
                ) {
                    taxacao_status = "aprovado";
                }

                return { ...envio, taxacao_status } as TaxacaoEnvio;
            });
        },
        enabled: !!loja && !!taxEventos?.taxacao_ordem,
    });

    // ── Approve mutation ──
    const approveMutation = useMutation({
        mutationFn: async (envioId: string) => {
            if (!loja?.id) throw new Error("Loja não encontrada");
            const result = await triggerNextEmail(envioId, loja.id, true);
            if (!result) throw new Error("Erro ao avançar o fluxo");
            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["taxacao-envios"] });
            queryClient.invalidateQueries({ queryKey: ["envios"] });
            toast.success("Pagamento aprovado! Fluxo avançado com sucesso.");
        },
        onError: (err: Error) => {
            toast.error(err.message || "Erro ao aprovar pagamento");
        },
    });

    // ── Filter ──
    const pendentes = envios.filter((e) => e.taxacao_status === "pendente");
    const aprovados = envios.filter((e) => e.taxacao_status === "aprovado");

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

    // ── Stats ──
    const totalPendentes = pendentes.length;
    const totalAprovados = aprovados.length;
    const totalValorPendente = pendentes.reduce((sum, e) => sum + Number(e.valor), 0);

    // ── No tax events configured ──
    if (!isLoading && !taxEventos?.taxacao_ordem) {
        return (
            <AppLayout title="Taxação">
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <AlertTriangle className="h-16 w-16 text-muted-foreground/30 mb-4" />
                    <h2 className="text-xl font-bold text-foreground/80 mb-2">
                        Taxação não configurada
                    </h2>
                    <p className="text-sm text-muted-foreground max-w-md">
                        Configure o evento de "Taxação" no seu template de postagens para habilitar a gestão de pagamentos.
                        Acesse <strong>Postagens → Template</strong> e adicione um evento com status_label "Taxação".
                    </p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout title="Taxação">
            <div className="space-y-6">
                <p className="text-sm text-muted-foreground -mt-2">
                    Gerencie os pagamentos de taxas de importação dos seus clientes.
                </p>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="border-amber-500/20 bg-amber-500/5">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">
                                        Pendentes
                                    </p>
                                    <p className="text-3xl font-bold text-amber-500 mt-1">
                                        {totalPendentes}
                                    </p>
                                </div>
                                <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                                    <Clock className="h-6 w-6 text-amber-500" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-green-500/20 bg-green-500/5">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-green-600 uppercase tracking-wider">
                                        Aprovados
                                    </p>
                                    <p className="text-3xl font-bold text-green-500 mt-1">
                                        {totalAprovados}
                                    </p>
                                </div>
                                <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-blue-500/20 bg-blue-500/5">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-blue-600 uppercase tracking-wider">
                                        Valor Pendente
                                    </p>
                                    <p className="text-3xl font-bold text-blue-500 mt-1">
                                        R$ {totalValorPendente.toFixed(2)}
                                    </p>
                                </div>
                                <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                    <CreditCard className="h-6 w-6 text-blue-500" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Tabs + Table */}
                <Tabs value={tab} onValueChange={setTab}>
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <TabsList>
                            <TabsTrigger value="pendentes" className="gap-2">
                                <Clock className="h-3.5 w-3.5" />
                                Pendentes
                                {totalPendentes > 0 && (
                                    <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">
                                        {totalPendentes}
                                    </Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="aprovados" className="gap-2">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Aprovados
                            </TabsTrigger>
                        </TabsList>

                        <div className="relative w-full md:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar cliente, produto..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </div>

                    <TabsContent value="pendentes" className="mt-4">
                        <Card>
                            <CardContent className="p-0">
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-16">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : filteredList.length === 0 ? (
                                    <EmptyState
                                        icon={<ShieldCheck className="h-12 w-12" />}
                                        title="Nenhum pagamento pendente"
                                        description="Todos os pagamentos de taxas foram aprovados."
                                    />
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Cliente</TableHead>
                                                <TableHead>Produto</TableHead>
                                                <TableHead>Valor</TableHead>
                                                <TableHead>Rastreio</TableHead>
                                                <TableHead>Data Taxação</TableHead>
                                                <TableHead className="text-right">Ação</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredList.map((envio) => (
                                                <TableRow key={envio.id} className="group">
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                                                                <User className="h-4 w-4 text-amber-500" />
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-sm">{envio.cliente_nome}</div>
                                                                <div className="text-xs text-muted-foreground">{envio.cliente_email}</div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <Package className="h-3.5 w-3.5 text-muted-foreground" />
                                                            <span className="text-sm">{envio.produto}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="font-semibold text-sm">
                                                            R$ {Number(envio.valor).toFixed(2)}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        {envio.codigo_rastreio ? (
                                                            <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                                                                {envio.codigo_rastreio}
                                                            </code>
                                                        ) : (
                                                            <span className="text-muted-foreground text-xs">—</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-xs text-muted-foreground">
                                                            {format(new Date(envio.updated_at), "dd/MM/yyyy HH:mm")}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            size="sm"
                                                            className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                                                            disabled={approveMutation.isPending}
                                                            onClick={() => approveMutation.mutate(envio.id)}
                                                        >
                                                            {approveMutation.isPending ? (
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                            ) : (
                                                                <ShieldCheck className="h-3.5 w-3.5" />
                                                            )}
                                                            Aprovar
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="aprovados" className="mt-4">
                        <Card>
                            <CardContent className="p-0">
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-16">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : filteredList.length === 0 ? (
                                    <EmptyState
                                        icon={<Clock className="h-12 w-12" />}
                                        title="Nenhum pagamento aprovado"
                                        description="Os pagamentos aprovados aparecerão aqui."
                                    />
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Cliente</TableHead>
                                                <TableHead>Produto</TableHead>
                                                <TableHead>Valor</TableHead>
                                                <TableHead>Rastreio</TableHead>
                                                <TableHead>Data Aprovação</TableHead>
                                                <TableHead>Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredList.map((envio) => (
                                                <TableRow key={envio.id}>
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                                                                <User className="h-4 w-4 text-green-500" />
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-sm">{envio.cliente_nome}</div>
                                                                <div className="text-xs text-muted-foreground">{envio.cliente_email}</div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <Package className="h-3.5 w-3.5 text-muted-foreground" />
                                                            <span className="text-sm">{envio.produto}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="font-semibold text-sm">
                                                            R$ {Number(envio.valor).toFixed(2)}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        {envio.codigo_rastreio ? (
                                                            <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                                                                {envio.codigo_rastreio}
                                                            </code>
                                                        ) : (
                                                            <span className="text-muted-foreground text-xs">—</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-xs text-muted-foreground">
                                                            {format(new Date(envio.updated_at), "dd/MM/yyyy HH:mm")}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge className="bg-green-500/10 text-green-600 border-green-500/20 gap-1">
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            Aprovado
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
    );
}

/* ─── Empty State ─── */
function EmptyState({
    icon,
    title,
    description,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
}) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <div className="opacity-30 mb-3">{icon}</div>
            <p className="font-medium">{title}</p>
            <p className="text-sm mt-1">{description}</p>
        </div>
    );
}
