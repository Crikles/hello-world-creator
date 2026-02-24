import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmailEditor } from "@/components/postagens/EmailEditor";
import {
  Mail,
  Package,
  Truck,
  CheckCircle2,
  FileText,
  MapPin,
  AlertTriangle,
  CreditCard,
  Edit2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface PostagemEvento {
  id: string;
  template_id: string;
  nome: string;
  descricao: string | null;
  status_label: string | null;
  ordem: number;
  delay_horas: number;
  enviar_email: boolean;
  enviar_nfe_pdf: boolean;
  assunto_email: string | null;
  corpo_email: string | null;
  is_final: boolean;
}

interface PostagemTemplate {
  id: string;
  loja_id: string | null;
  nome: string;
  descricao: string | null;
  tipo: string;
  is_system: boolean;
}

const iconMap: Record<string, React.ElementType> = {
  "Postado": FileText,
  "Coletado": Package,
  "Em Trânsito": Truck,
  "Centro Local": MapPin,
  "Saiu para Entrega": Truck,
  "Entregue": CheckCircle2,
  "Taxação": AlertTriangle,
  "Pago": CreditCard,
  "Em Rota": Truck,
};

const badgeColor: Record<string, string> = {
  "Postado": "bg-blue-100 text-blue-800",
  "Coletado": "bg-indigo-100 text-indigo-800",
  "Em Trânsito": "bg-yellow-100 text-yellow-800",
  "Centro Local": "bg-purple-100 text-purple-800",
  "Saiu para Entrega": "bg-orange-100 text-orange-800",
  "Entregue": "bg-green-100 text-green-800",
  "Taxação": "bg-red-100 text-red-800",
  "Pago": "bg-emerald-100 text-emerald-800",
  "Em Rota": "bg-amber-100 text-amber-800",
};

export default function AdminTemplates() {
  const queryClient = useQueryClient();
  const [editingEvento, setEditingEvento] = useState<PostagemEvento | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data: templates } = useQuery({
    queryKey: ["admin-system-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("postagem_templates")
        .select("*")
        .eq("is_system", true)
        .order("tipo");
      if (error) throw error;
      return data as PostagemTemplate[];
    },
  });

  const { data: eventos } = useQuery({
    queryKey: ["admin-system-eventos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("postagem_eventos")
        .select("*")
        .in(
          "template_id",
          templates?.map((t) => t.id) || []
        )
        .order("ordem");
      if (error) throw error;
      return data as PostagemEvento[];
    },
    enabled: !!templates && templates.length > 0,
  });

  const updateEvento = useMutation({
    mutationFn: async (evento: Partial<PostagemEvento> & { id: string }) => {
      const { error } = await supabase
        .from("postagem_eventos")
        .update(evento)
        .eq("id", evento.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-system-eventos"] });
      setEditDialogOpen(false);
      toast({ title: "Evento atualizado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar evento", variant: "destructive" });
    },
  });

  const handleSaveEvento = (data: {
    assunto_email: string;
    corpo_email: string;
    enviar_email: boolean;
    enviar_nfe_pdf: boolean;
  }) => {
    if (!editingEvento) return;
    updateEvento.mutate({ id: editingEvento.id, ...data });
  };

  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestão de Templates</h1>
          <p className="text-muted-foreground">
            Edite os templates de email do sistema. As alterações afetam todas as contas.
          </p>
        </div>

        {templates?.map((template) => {
          const templateEventos = eventos
            ?.filter((e) => e.template_id === template.id)
            .sort((a, b) => a.ordem - b.ordem) || [];

          return (
            <Card key={template.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{template.nome}</CardTitle>
                    <CardDescription className="text-sm">{template.descricao}</CardDescription>
                  </div>
                  <Badge variant="outline">{templateEventos.length} eventos</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {templateEventos.map((evento) => {
                  const Icon = iconMap[evento.status_label || ""] || Mail;
                  const color = badgeColor[evento.status_label || ""] || "bg-muted text-muted-foreground";

                  return (
                    <div
                      key={evento.id}
                      className="flex items-center gap-4 py-3 px-4 rounded-lg border"
                    >
                      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{evento.nome}</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
                            {evento.status_label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          Assunto: {evento.assunto_email || "(sem assunto)"}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          {evento.enviar_email && (
                            <span className="flex items-center gap-1 text-primary">
                              <Mail className="h-3 w-3" />
                              Email ativo
                            </span>
                          )}
                          {evento.enviar_nfe_pdf && (
                            <span className="flex items-center gap-1 text-primary">
                              <FileText className="h-3 w-3" />
                              NFe anexa
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => {
                          setEditingEvento(evento);
                          setEditDialogOpen(true);
                        }}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {editingEvento && (
        <EmailEditor
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          eventoNome={editingEvento.nome}
          statusLabel={editingEvento.status_label || ""}
          initialAssunto={editingEvento.assunto_email || ""}
          initialCorpo={editingEvento.corpo_email || ""}
          enviarEmail={editingEvento.enviar_email}
          enviarNfePdf={editingEvento.enviar_nfe_pdf}
          onSave={handleSaveEvento}
          saving={updateEvento.isPending}
        />
      )}
    </AdminLayout>
  );
}
