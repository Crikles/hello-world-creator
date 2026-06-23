import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Bell,
    Save,
    Send,
    Image,
    Link2,
    Users,
    CheckCircle2,
    XCircle,
    Settings2,
    History,
    Megaphone,
    Trash2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PushSettings {
    id: string;
    icon_url: string;
    badge_url: string;
    default_url: string;
}

interface PushLog {
    id: string;
    title: string;
    body: string;
    url: string | null;
    icon_url: string | null;
    total_sent: number;
    total_failed: number;
    created_at: string;
}

interface PushTemplate {
    id: string;
    nome: string;
    titulo: string;
    mensagem: string;
    url: string | null;
    icon_url: string | null;
    created_at: string;
}

export default function AdminPush() {
    const queryClient = useQueryClient();

    // ─── Settings ───
    const [iconUrl, setIconUrl] = useState("");
    const [badgeUrl, setBadgeUrl] = useState("");
    const [defaultUrl, setDefaultUrl] = useState("");

    // ─── Send Form ───
    const [pushTitle, setPushTitle] = useState("");
    const [pushBody, setPushBody] = useState("");
    const [pushUrl, setPushUrl] = useState("");
    const [pushIcon, setPushIcon] = useState("");

    // ─── Templates ───
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
    const [templateName, setTemplateName] = useState("");
    const [showSaveInput, setShowSaveInput] = useState(false);

    // ─── Queries ───
    const { data: settings, isLoading: loadingSettings } = useQuery({
        queryKey: ["push-settings"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("push_notification_settings")
                .select("*")
                .limit(1)
                .maybeSingle();
            if (error) throw error;
            return data as PushSettings | null;
        },
    });

    const { data: subscriberCount } = useQuery({
        queryKey: ["push-subscriber-count"],
        queryFn: async () => {
            const { count, error } = await supabase
                .from("push_subscriptions")
                .select("*", { count: "exact", head: true });
            if (error) throw error;
            return count || 0;
        },
    });

    const { data: logs, isLoading: loadingLogs } = useQuery({
        queryKey: ["push-logs"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("push_notification_log")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(50);
            if (error) throw error;
            return data as PushLog[];
        },
    });

    const { data: templates } = useQuery({
        queryKey: ["push-templates"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("push_templates")
                .select("*")
                .order("created_at", { ascending: true });
            if (error) throw error;
            return data as PushTemplate[];
        },
    });

    // Populate settings form when data loads
    useEffect(() => {
        if (settings) {
            setIconUrl(settings.icon_url || "");
            setBadgeUrl(settings.badge_url || "");
            setDefaultUrl(settings.default_url || "");
        }
    }, [settings]);

    // ─── Save Settings Mutation ───
    const saveSettingsMutation = useMutation({
        mutationFn: async () => {
            if (settings?.id) {
                const { error } = await supabase
                    .from("push_notification_settings")
                    .update({
                        icon_url: iconUrl,
                        badge_url: badgeUrl,
                        default_url: defaultUrl,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", settings.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from("push_notification_settings")
                    .insert({
                        icon_url: iconUrl,
                        badge_url: badgeUrl,
                        default_url: defaultUrl,
                    });
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["push-settings"] });
            toast({ title: "Configurações salvas com sucesso!" });
        },
        onError: () => {
            toast({ title: "Erro ao salvar configurações", variant: "destructive" });
        },
    });

    // ─── Send Push Mutation ───
    const sendPushMutation = useMutation({
        mutationFn: async () => {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

            const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${anonKey}`,
                    apikey: anonKey,
                },
                body: JSON.stringify({
                    title: pushTitle,
                    body: pushBody,
                    url: pushUrl || undefined,
                    icon: pushIcon || undefined,
                }),
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || "Falha ao enviar notificações");
            }

            return response.json();
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["push-logs"] });
            toast({
                title: "Notificações enviadas!",
                description: `${data.totalSent} enviadas, ${data.totalFailed} falhas`,
            });
            setPushTitle("");
            setPushBody("");
            setPushUrl("");
            setPushIcon("");
            setSelectedTemplateId("");
        },
        onError: (err: Error) => {
            toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
        },
    });

    // ─── Save Template Mutation ───
    const saveTemplateMutation = useMutation({
        mutationFn: async (nome: string) => {
            const { error } = await supabase
                .from("push_templates")
                .insert({
                    nome,
                    titulo: pushTitle,
                    mensagem: pushBody,
                    url: pushUrl || null,
                    icon_url: pushIcon || null,
                });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["push-templates"] });
            toast({ title: "Template salvo com sucesso!" });
            setTemplateName("");
            setShowSaveInput(false);
        },
        onError: () => {
            toast({ title: "Erro ao salvar template", variant: "destructive" });
        },
    });

    // ─── Delete Template Mutation ───
    const deleteTemplateMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from("push_templates")
                .delete()
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["push-templates"] });
            setSelectedTemplateId("");
            toast({ title: "Template excluído!" });
        },
        onError: () => {
            toast({ title: "Erro ao excluir template", variant: "destructive" });
        },
    });

    // ─── Template Selection Handler ───
    const handleTemplateSelect = (templateId: string) => {
        if (templateId === "none") {
            setSelectedTemplateId("");
            setPushTitle("");
            setPushBody("");
            setPushUrl("");
            setPushIcon("");
            return;
        }
        setSelectedTemplateId(templateId);
        const template = templates?.find((t) => t.id === templateId);
        if (template) {
            setPushTitle(template.titulo);
            setPushBody(template.mensagem);
            setPushUrl(template.url || "");
            setPushIcon(template.icon_url || "");
        }
    };

    const handleSaveTemplate = () => {
        if (!templateName.trim()) {
            toast({ title: "Digite um nome para o template", variant: "destructive" });
            return;
        }
        if (!pushTitle || !pushBody) {
            toast({ title: "Preencha título e mensagem antes de salvar", variant: "destructive" });
            return;
        }
        saveTemplateMutation.mutate(templateName.trim());
    };

    // ─── Stats ───
    const totalSent = logs?.reduce((sum, l) => sum + (l.total_sent || 0), 0) || 0;
    const totalFailed = logs?.reduce((sum, l) => sum + (l.total_failed || 0), 0) || 0;

    return (
        <AdminLayout>
            <div className="space-y-6 max-w-5xl">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Bell className="h-7 w-7" />
                        Push Web Notifications
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Gerencie notificações push, personalize o ícone e link de direcionamento, e envie mensagens para seus leads.
                    </p>
                </div>

                {/* Stats Cards */}
                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Inscritos</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{subscriberCount ?? 0}</div>
                            <p className="text-xs text-muted-foreground">Leads com push ativo</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Enviadas</CardTitle>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">{totalSent}</div>
                            <p className="text-xs text-muted-foreground">Total com sucesso</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Falhas</CardTitle>
                            <XCircle className="h-4 w-4 text-destructive" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-destructive">{totalFailed}</div>
                            <p className="text-xs text-muted-foreground">Erros de entrega</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Campanhas</CardTitle>
                            <Megaphone className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{logs?.length ?? 0}</div>
                            <p className="text-xs text-muted-foreground">Notificações enviadas</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Two Column Layout */}
                <div className="grid gap-6 lg:grid-cols-2">
                    {/* ─── Settings Card ─── */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Settings2 className="h-5 w-5" />
                                Configurações Padrão
                            </CardTitle>
                            <CardDescription>
                                Personalize o ícone e link padrão das notificações push.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <Image className="h-4 w-4 text-muted-foreground" />
                                    URL do Ícone
                                </label>
                                <Input
                                    placeholder="https://exemplo.com/icone.png ou /favicon.ico"
                                    value={iconUrl}
                                    onChange={(e) => setIconUrl(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Imagem exibida na notificação (recomendado: 192x192px, PNG)
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <Image className="h-4 w-4 text-muted-foreground" />
                                    URL do Badge
                                </label>
                                <Input
                                    placeholder="https://exemplo.com/badge.png ou /favicon.ico"
                                    value={badgeUrl}
                                    onChange={(e) => setBadgeUrl(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Ícone pequeno exibido na barra de status (Android)
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <Link2 className="h-4 w-4 text-muted-foreground" />
                                    URL de Direcionamento Padrão
                                </label>
                                <Input
                                    placeholder="https://app.atlas-cargo.org/"
                                    value={defaultUrl}
                                    onChange={(e) => setDefaultUrl(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Link aberto quando o usuário clica na notificação
                                </p>
                            </div>

                            {/* Preview */}
                            {iconUrl && (
                                <div className="border rounded-lg p-3 bg-muted/30">
                                    <p className="text-xs font-medium text-muted-foreground mb-2">Preview do Ícone:</p>
                                    <div className="flex items-center gap-3">
                                        <img
                                            src={iconUrl}
                                            alt="Ícone push"
                                            className="w-12 h-12 rounded-lg object-contain bg-white border"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = "none";
                                            }}
                                        />
                                        <span className="text-sm text-muted-foreground">192×192px recomendado</span>
                                    </div>
                                </div>
                            )}

                            <Button
                                className="w-full"
                                onClick={() => saveSettingsMutation.mutate()}
                                disabled={saveSettingsMutation.isPending}
                            >
                                <Save className="h-4 w-4 mr-2" />
                                {saveSettingsMutation.isPending ? "Salvando..." : "Salvar Configurações"}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* ─── Send Push Card ─── */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Send className="h-5 w-5" />
                                Enviar Notificação
                            </CardTitle>
                            <CardDescription>
                                Envie uma notificação push para todos os leads inscritos.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* ─── Template Selector ─── */}
                            {templates && templates.length > 0 && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                        <Save className="h-4 w-4 text-muted-foreground" />
                                        Template Salvo
                                    </label>
                                    <div className="flex gap-2">
                                        <Select value={selectedTemplateId || "none"} onValueChange={handleTemplateSelect}>
                                            <SelectTrigger className="flex-1">
                                                <SelectValue placeholder="Selecionar template..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Nenhum (limpar campos)</SelectItem>
                                                {templates.map((t) => (
                                                    <SelectItem key={t.id} value={t.id}>
                                                        {t.nome}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {selectedTemplateId && (
                                            <Button
                                                variant="destructive"
                                                size="icon"
                                                onClick={() => deleteTemplateMutation.mutate(selectedTemplateId)}
                                                disabled={deleteTemplateMutation.isPending}
                                                title="Excluir template"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Título *</label>
                                <Input
                                    placeholder="Ex: Seu pedido foi atualizado!"
                                    value={pushTitle}
                                    onChange={(e) => setPushTitle(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Mensagem *</label>
                                <Textarea
                                    placeholder="Ex: Seu pedido BR1234 está em trânsito."
                                    value={pushBody}
                                    onChange={(e) => setPushBody(e.target.value)}
                                    rows={3}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <Link2 className="h-4 w-4 text-muted-foreground" />
                                    Link de Direcionamento
                                    <Badge variant="secondary" className="text-[10px]">Opcional</Badge>
                                </label>
                                <Input
                                    placeholder="https://app.atlas-cargo.org/r/CODIGO"
                                    value={pushUrl}
                                    onChange={(e) => setPushUrl(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <Image className="h-4 w-4 text-muted-foreground" />
                                    Ícone Personalizado
                                    <Badge variant="secondary" className="text-[10px]">Opcional</Badge>
                                </label>
                                <Input
                                    placeholder="Deixe em branco para usar o ícone padrão"
                                    value={pushIcon}
                                    onChange={(e) => setPushIcon(e.target.value)}
                                />
                            </div>

                            {/* Preview */}
                            <div className="border rounded-lg p-4 bg-muted/30 space-y-1">
                                <p className="text-xs font-medium text-muted-foreground mb-2">Preview da Notificação:</p>
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                        {(pushIcon || iconUrl) ? (
                                            <img
                                                src={pushIcon || iconUrl}
                                                alt="icon"
                                                className="w-10 h-10 object-contain"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = "none";
                                                }}
                                            />
                                        ) : (
                                            <Bell className="h-5 w-5 text-primary" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold truncate">
                                            {pushTitle || "Título da notificação"}
                                        </p>
                                        <p className="text-xs text-muted-foreground whitespace-pre-line line-clamp-4">
                                            {pushBody || "Mensagem da notificação aparecerá aqui..."}
                                        </p>
                                        {pushUrl && (
                                            <p className="text-[10px] text-primary mt-1 truncate">{pushUrl}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* ─── Save Template Input ─── */}
                            {showSaveInput && (
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Nome do template (ex: Pedido taxado)"
                                        value={templateName}
                                        onChange={(e) => setTemplateName(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleSaveTemplate()}
                                    />
                                    <Button
                                        size="sm"
                                        onClick={handleSaveTemplate}
                                        disabled={saveTemplateMutation.isPending}
                                    >
                                        {saveTemplateMutation.isPending ? "..." : "Salvar"}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => { setShowSaveInput(false); setTemplateName(""); }}
                                    >
                                        Cancelar
                                    </Button>
                                </div>
                            )}

                            {/* ─── Action Buttons ─── */}
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => setShowSaveInput(true)}
                                    disabled={!pushTitle || !pushBody || showSaveInput}
                                >
                                    <Save className="h-4 w-4 mr-2" />
                                    Salvar Template
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={() => sendPushMutation.mutate()}
                                    disabled={sendPushMutation.isPending || !pushTitle || !pushBody}
                                >
                                    <Send className="h-4 w-4 mr-2" />
                                    {sendPushMutation.isPending
                                        ? "Enviando..."
                                        : `Enviar para ${subscriberCount ?? 0} inscritos`}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* ─── History Table ─── */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <History className="h-5 w-5" />
                            Histórico de Envios
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loadingLogs ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Data</TableHead>
                                        <TableHead>Título</TableHead>
                                        <TableHead>Mensagem</TableHead>
                                        <TableHead>Enviadas</TableHead>
                                        <TableHead>Falhas</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {logs?.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                Nenhuma notificação enviada ainda.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        logs?.map((log) => (
                                            <TableRow key={log.id}>
                                                <TableCell className="whitespace-nowrap">
                                                    {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                                </TableCell>
                                                <TableCell className="font-medium max-w-[200px] truncate">
                                                    {log.title}
                                                </TableCell>
                                                <TableCell className="max-w-[250px] truncate text-muted-foreground">
                                                    {log.body}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className="bg-green-500 hover:bg-green-600">{log.total_sent}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {log.total_failed > 0 ? (
                                                        <Badge variant="destructive">{log.total_failed}</Badge>
                                                    ) : (
                                                        <Badge variant="outline">0</Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
}
