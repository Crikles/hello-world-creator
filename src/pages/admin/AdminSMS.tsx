import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Save, RotateCcw, Eye } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface SmsTemplate {
  id: string;
  status_key: string;
  status_label: string;
  mensagem: string;
}

export default function AdminSMS() {
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
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
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
    </AdminLayout>
  );
}
