import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Save, RotateCcw, Eye, List, CheckCircle, XCircle, AlertCircle, Clock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface SmsTemplate {
  id: string;
  status_key: string;
  status_label: string;
  mensagem: string;
}

interface SmsLog {
  id: string;
  envio_id: string;
  loja_id: string;
  loja_nome?: string;
  user_id: string;
  evento_id: string;
  status_label: string;
  status: "sent" | "failed" | "skipped";
  motivo: string;
  telefone: string;
  custo: number;
  provider_response: any;
  created_at: string;
}

function SmsTemplates() {
  const queryClient = useQueryClient();
  const [editedMessages, setEditedMessages] = useState<Record<string, string>>({});
  const [previewKey, setPreviewKey] = useState<string | null>(null);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["sms-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_templates")
        .select("*")
        .order("status_key");
      if (error) throw error;
      return data as SmsTemplate[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, mensagem }: { id: string; mensagem: string }) => {
      const { error } = await supabase
        .from("sms_templates")
        .update({ mensagem })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sms-templates"] });
      toast({ title: "Template salvo com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao salvar template", variant: "destructive" });
    },
  });

  const handleSave = (template: SmsTemplate) => {
    const msg = editedMessages[template.id];
    if (msg === undefined) return;
    saveMutation.mutate({ id: template.id, mensagem: msg });
    setEditedMessages((prev) => {
      const next = { ...prev };
      delete next[template.id];
      return next;
    });
  };

  const handleReset = (template: SmsTemplate) => {
    setEditedMessages((prev) => {
      const next = { ...prev };
      delete next[template.id];
      return next;
    });
  };

  const getCurrentMessage = (template: SmsTemplate) =>
    editedMessages[template.id] ?? template.mensagem;

  const getPreview = (msg: string) =>
    msg.replace(/\{nome\}/g, "João").replace(/\{link\}/g, "https://atlas-cargo.org/r/BR1234ABCDEF");

  const hasChanges = Object.keys(editedMessages).length > 0;

  const handleSaveAll = () => {
    if (!templates) return;
    Object.entries(editedMessages).forEach(([id, mensagem]) => {
      saveMutation.mutate({ id, mensagem });
    });
    setEditedMessages({});
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="h-6 w-6" />
            Templates de SMS
          </h1>
          <p className="text-muted-foreground mt-1">
            Edite as mensagens enviadas por SMS em cada etapa do rastreio.
            Use <Badge variant="secondary" className="mx-1">{"{nome}"}</Badge> para o nome do cliente e
            <Badge variant="secondary" className="mx-1">{"{link}"}</Badge> para o link de rastreio.
          </p>
        </div>
        {hasChanges && (
          <Button onClick={handleSaveAll} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            Salvar Tudo
          </Button>
        )}
      </div>

      <div className="grid gap-4">
        {templates?.map((template) => {
          const isEdited = editedMessages[template.id] !== undefined;
          const currentMsg = getCurrentMessage(template);
          const showPreview = previewKey === template.id;

          return (
            <Card key={template.id} className={isEdited ? "border-primary" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{template.status_label}</CardTitle>
                    <CardDescription className="text-xs">
                      Chave: {template.status_key}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreviewKey(showPreview ? null : template.id)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Preview
                    </Button>
                    {isEdited && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => handleReset(template)}>
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Desfazer
                        </Button>
                        <Button size="sm" onClick={() => handleSave(template)} disabled={saveMutation.isPending}>
                          <Save className="h-4 w-4 mr-1" />
                          Salvar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={currentMsg}
                  onChange={(e) =>
                    setEditedMessages((prev) => ({
                      ...prev,
                      [template.id]: e.target.value,
                    }))
                  }
                  rows={3}
                  className="font-mono text-sm"
                />
                {showPreview && (
                  <div className="bg-muted rounded-md p-3">
                    <p className="text-xs text-muted-foreground mb-1 font-medium">Preview:</p>
                    <p className="text-sm">{getPreview(currentMsg)}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function SmsLogs() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["sms-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_log")
        .select("*, lojas(nome)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []).map((row: any) => ({
        ...row,
        loja_nome: row.lojas?.nome || "—",
      })) as SmsLog[];
    },
    refetchInterval: 30000, // recarrega a cada 30s
  });

  const { data: stats } = useQuery({
    queryKey: ["sms-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_log")
        .select("status", { count: "exact" });
      if (error) throw error;
      const sent = (data || []).filter((r: any) => r.status === "sent").length;
      const failed = (data || []).filter((r: any) => r.status === "failed").length;
      const skipped = (data || []).filter((r: any) => r.status === "skipped").length;
      return { sent, failed, skipped, total: (data || []).length };
    },
    refetchInterval: 30000,
  });

  const formatDate = (d: string) =>
    new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const statusIcon = (status: string) => {
    switch (status) {
      case "sent": return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case "failed": return <XCircle className="h-4 w-4 text-red-500" />;
      case "skipped": return <AlertCircle className="h-4 w-4 text-amber-500" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "sent": return "Enviado";
      case "failed": return "Falhou";
      case "skipped": return "Pulado";
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <List className="h-6 w-6" />
          Logs de SMS
        </h1>
        <p className="text-muted-foreground mt-1">
          Acompanhe em tempo real os SMS enviados, falhas e pulados. Atualiza a cada 30 segundos.
        </p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Total</CardDescription>
              <CardTitle className="text-2xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Enviados</CardDescription>
              <CardTitle className="text-2xl text-emerald-600">{stats.sent}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Falhas</CardDescription>
              <CardTitle className="text-2xl text-red-600">{stats.failed}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Pulados</CardDescription>
              <CardTitle className="text-2xl text-amber-600">{stats.skipped}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : logs && logs.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted border-b">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Loja</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Evento</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Telefone</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Motivo</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Custo</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {statusIcon(log.status)}
                        <span className="font-medium">{statusLabel(log.status)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(log.created_at)}</td>
                    <td className="px-4 py-3">{log.loja_nome}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{log.status_label}</Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{log.telefone}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{log.motivo || "—"}</td>
                    <td className="px-4 py-3 text-right font-mono">R$ {log.custo?.toFixed(2) ?? "0.00"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Nenhum SMS enviado ainda</p>
          <p className="text-sm mt-1">Os logs aparecerão aqui automaticamente quando os envios avançarem de etapa.</p>
        </div>
      )}
    </div>
  );
}

export default function AdminSMS() {
  return (
    <AdminLayout>
      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="logs">Logs de Envio</TabsTrigger>
        </TabsList>
        <TabsContent value="templates">
          <SmsTemplates />
        </TabsContent>
        <TabsContent value="logs">
          <SmsLogs />
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
