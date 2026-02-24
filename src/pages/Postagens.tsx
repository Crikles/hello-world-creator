import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Mail,
  Package,
  Truck,
  CheckCircle2,
  FileText,
  Clock,
  Edit2,
  Trash2,
  GripVertical,
  Plus,
  AlertTriangle,
  Coins,
  MapPin,
  CreditCard,
  Box,
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

interface PostagemConfig {
  id: string;
  loja_id: string;
  template_ativo_id: string | null;
  enviar_emails: boolean;
  enviar_nfe_email: boolean;
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

export default function Postagens() {
  const { loja } = useLoja();
  const queryClient = useQueryClient();
  const [editingEvento, setEditingEvento] = useState<PostagemEvento | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    nome: "",
    descricao: "",
    status_label: "",
    delay_horas: 0,
    enviar_email: true,
    enviar_nfe_pdf: false,
    assunto_email: "",
    corpo_email: "",
  });

  // Fetch system templates
  const { data: systemTemplates } = useQuery({
    queryKey: ["postagem-templates-system"],
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

  // Fetch system template eventos for preview
  const { data: systemEventos } = useQuery({
    queryKey: ["postagem-eventos-system"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("postagem_eventos")
        .select("*")
        .in("template_id", [
          "00000000-0000-0000-0000-000000000001",
          "00000000-0000-0000-0000-000000000002",
          "00000000-0000-0000-0000-000000000003",
        ])
        .order("ordem");
      if (error) throw error;
      return data as PostagemEvento[];
    },
  });

  // Fetch config for current loja
  const { data: config } = useQuery({
    queryKey: ["postagem-config", loja?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("postagem_config")
        .select("*")
        .eq("loja_id", loja!.id)
        .maybeSingle();
      if (error) throw error;
      return data as PostagemConfig | null;
    },
    enabled: !!loja,
  });

  // Fetch active template eventos
  const { data: activeEventos } = useQuery({
    queryKey: ["postagem-eventos-active", config?.template_ativo_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("postagem_eventos")
        .select("*")
        .eq("template_id", config!.template_ativo_id!)
        .order("ordem");
      if (error) throw error;
      return data as PostagemEvento[];
    },
    enabled: !!config?.template_ativo_id,
  });

  // Apply template mutation
  const applyTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      if (!loja) return;

      // Find the system template
      const systemTemplate = systemTemplates?.find((t) => t.id === templateId);
      if (!systemTemplate) return;

      // Get system template events
      const evts = systemEventos?.filter((e) => e.template_id === templateId) || [];

      // Create a copy of the template for this loja
      const { data: newTemplate, error: tErr } = await supabase
        .from("postagem_templates")
        .insert({
          loja_id: loja.id,
          nome: systemTemplate.nome,
          descricao: systemTemplate.descricao,
          tipo: systemTemplate.tipo,
          is_system: false,
        })
        .select()
        .single();
      if (tErr) throw tErr;

      // Copy events
      if (evts.length > 0) {
        const { error: eErr } = await supabase.from("postagem_eventos").insert(
          evts.map((e) => ({
            template_id: newTemplate.id,
            nome: e.nome,
            descricao: e.descricao,
            status_label: e.status_label,
            ordem: e.ordem,
            delay_horas: e.delay_horas,
            enviar_email: e.enviar_email,
            enviar_nfe_pdf: e.enviar_nfe_pdf,
            assunto_email: e.assunto_email,
            corpo_email: e.corpo_email,
            is_final: e.is_final,
          }))
        );
        if (eErr) throw eErr;
      }

      // Upsert config
      const { error: cErr } = await supabase.from("postagem_config").upsert(
        {
          loja_id: loja.id,
          template_ativo_id: newTemplate.id,
          enviar_emails: config?.enviar_emails ?? true,
          enviar_nfe_email: config?.enviar_nfe_email ?? true,
        },
        { onConflict: "loja_id" }
      );
      if (cErr) throw cErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["postagem-config"] });
      queryClient.invalidateQueries({ queryKey: ["postagem-eventos-active"] });
      toast({ title: "Template aplicado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao aplicar template", variant: "destructive" });
    },
  });

  // Toggle config
  const toggleConfig = useMutation({
    mutationFn: async (field: "enviar_emails" | "enviar_nfe_email") => {
      if (!loja || !config) return;
      await supabase
        .from("postagem_config")
        .update({ [field]: !config[field] })
        .eq("loja_id", loja.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["postagem-config"] });
    },
  });

  // Update evento
  const updateEvento = useMutation({
    mutationFn: async (evento: Partial<PostagemEvento> & { id: string }) => {
      const { error } = await supabase
        .from("postagem_eventos")
        .update(evento)
        .eq("id", evento.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["postagem-eventos-active"] });
      setEditDialogOpen(false);
      toast({ title: "Evento atualizado!" });
    },
  });

  // Delete evento
  const deleteEvento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("postagem_eventos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["postagem-eventos-active"] });
      toast({ title: "Evento removido!" });
    },
  });

  // Add evento
  const addEvento = useMutation({
    mutationFn: async () => {
      if (!config?.template_ativo_id) return;
      const maxOrdem = activeEventos?.reduce((max, e) => Math.max(max, e.ordem), 0) ?? 0;
      const { error } = await supabase.from("postagem_eventos").insert({
        template_id: config.template_ativo_id,
        nome: "Novo Evento",
        descricao: "Descrição do evento",
        status_label: "Status",
        ordem: maxOrdem + 1,
        delay_horas: 0,
        enviar_email: true,
        enviar_nfe_pdf: false,
        assunto_email: "{{produto}} - Atualização",
        corpo_email: "<p>Olá {{cliente_nome}},</p><p>Atualização sobre seu pedido.</p>",
        is_final: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["postagem-eventos-active"] });
      toast({ title: "Evento adicionado!" });
    },
  });

  const openEditDialog = (evento: PostagemEvento) => {
    setEditingEvento(evento);
    setEditForm({
      nome: evento.nome,
      descricao: evento.descricao || "",
      status_label: evento.status_label || "",
      delay_horas: evento.delay_horas,
      enviar_email: evento.enviar_email,
      enviar_nfe_pdf: evento.enviar_nfe_pdf,
      assunto_email: evento.assunto_email || "",
      corpo_email: evento.corpo_email || "",
    });
    setEditDialogOpen(true);
  };

  const handleSaveEvento = () => {
    if (!editingEvento) return;
    updateEvento.mutate({
      id: editingEvento.id,
      ...editForm,
    });
  };

  const emailCount = activeEventos?.filter((e) => e.enviar_email).length ?? 0;
  const custoEstimado = (emailCount * 0.15).toFixed(2);

  const activeTemplate = config?.template_ativo_id
    ? systemTemplates?.find((t) => t.id === config.template_ativo_id) || null
    : null;

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Postagens</h1>
          <p className="text-muted-foreground">
            Gerencie os fluxos de email automáticos para cada evento de rastreamento
          </p>
        </div>

        {/* Configurações gerais */}
        {config && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Configurações Gerais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Enviar Emails</Label>
                  <p className="text-xs text-muted-foreground">Liga/desliga todo o sistema de emails</p>
                </div>
                <Switch
                  checked={config.enviar_emails}
                  onCheckedChange={() => toggleConfig.mutate("enviar_emails")}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Enviar NFe no Email</Label>
                  <p className="text-xs text-muted-foreground">Anexar PDF da Nota Fiscal no email de NF Emitida</p>
                </div>
                <Switch
                  checked={config.enviar_nfe_email}
                  onCheckedChange={() => toggleConfig.mutate("enviar_nfe_email")}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Templates pré-configurados */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Templates Pré-configurados</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {systemTemplates?.map((template) => {
              const evts = systemEventos?.filter((e) => e.template_id === template.id) || [];
              const isActive = config?.template_ativo_id && activeEventos?.[0]?.template_id
                ? (() => {
                    // Check if active template was cloned from this system template
                    const activeT = queryClient.getQueryData<PostagemTemplate[]>(["postagem-templates-system"]);
                    return false; // We'll match by tipo below
                  })()
                : false;

              return (
                <Card
                  key={template.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => applyTemplate.mutate(template.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{template.nome}</CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {evts.length} eventos
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">{template.descricao}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5">
                      {evts.map((e) => {
                        const color = badgeColor[e.status_label || ""] || "bg-muted text-muted-foreground";
                        return (
                          <span key={e.id} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
                            {e.status_label}
                          </span>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Aplicar substituirá eventos atuais
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Eventos do template ativo */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground">Eventos do Fluxo Ativo</h2>
            {config?.template_ativo_id && (
              <Button size="sm" variant="outline" onClick={() => addEvento.mutate()}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            )}
          </div>

          {!config?.template_ativo_id ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Box className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p>Selecione um template acima para começar</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {activeEventos?.map((evento) => {
                const Icon = iconMap[evento.status_label || ""] || Mail;
                const color = badgeColor[evento.status_label || ""] || "bg-muted text-muted-foreground";

                return (
                  <Card key={evento.id}>
                    <CardContent className="flex items-center gap-4 py-3 px-4">
                      <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab" />
                      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{evento.nome}</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
                            {evento.status_label}
                          </span>
                          {evento.is_final && (
                            <Badge variant="outline" className="text-xs">Final</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{evento.descricao}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          {evento.delay_horas > 0 && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {evento.delay_horas}h após anterior
                            </span>
                          )}
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
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(evento)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => deleteEvento.mutate(evento.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Custo estimado */}
        {config?.template_ativo_id && activeEventos && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Custo por Envio</p>
                  <p className="text-xs text-muted-foreground">
                    R$ 0,15 × {emailCount} eventos com email = R$ {custoEstimado}
                  </p>
                </div>
              </div>
              <span className="text-lg font-bold text-primary">R$ {custoEstimado}</span>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Evento</DialogTitle>
            <DialogDescription>Configure os detalhes deste evento de rastreamento</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome do Evento</Label>
                <Input
                  value={editForm.nome}
                  onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                />
              </div>
              <div>
                <Label>Label do Status</Label>
                <Input
                  value={editForm.status_label}
                  onChange={(e) => setEditForm({ ...editForm, status_label: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={editForm.descricao}
                onChange={(e) => setEditForm({ ...editForm, descricao: e.target.value })}
              />
            </div>
            <div>
              <Label>Delay (horas após evento anterior)</Label>
              <Input
                type="number"
                min={0}
                value={editForm.delay_horas}
                onChange={(e) => setEditForm({ ...editForm, delay_horas: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Enviar email neste evento</Label>
              <Switch
                checked={editForm.enviar_email}
                onCheckedChange={(v) => setEditForm({ ...editForm, enviar_email: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Anexar PDF da NFe</Label>
              <Switch
                checked={editForm.enviar_nfe_pdf}
                onCheckedChange={(v) => setEditForm({ ...editForm, enviar_nfe_pdf: v })}
              />
            </div>
            {editForm.enviar_email && (
              <>
                <div>
                  <Label>Assunto do Email</Label>
                  <Input
                    value={editForm.assunto_email}
                    onChange={(e) => setEditForm({ ...editForm, assunto_email: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Corpo do Email (HTML)</Label>
                  <Textarea
                    rows={5}
                    value={editForm.corpo_email}
                    onChange={(e) => setEditForm({ ...editForm, corpo_email: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Variáveis: {"{{cliente_nome}}"}, {"{{produto}}"}, {"{{codigo_rastreio}}"}, {"{{empresa_nome}}"}, {"{{status}}"}
                  </p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEvento} disabled={updateEvento.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
