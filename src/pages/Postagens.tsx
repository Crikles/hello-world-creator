import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { EmailEditor } from "@/components/postagens/EmailEditor";
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
  ativar_site_rastreio: boolean;
  ativar_taxacao: boolean;
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
  const { isAdmin } = useIsAdmin();
  const queryClient = useQueryClient();
  const [editingEvento, setEditingEvento] = useState<PostagemEvento | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

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
    mutationFn: async (field: "enviar_emails" | "enviar_nfe_email" | "ativar_site_rastreio" | "ativar_taxacao") => {
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
    setEditDialogOpen(true);
  };

  const handleSaveEvento = (data: {
    assunto_email: string;
    corpo_email: string;
    enviar_email: boolean;
    enviar_nfe_pdf: boolean;
  }) => {
    if (!editingEvento) return;
    updateEvento.mutate({
      id: editingEvento.id,
      ...data,
    });
  };

  const sortedActiveEventos = activeEventos?.slice().sort((a, b) => a.ordem - b.ordem);

  const custoMoedas = (() => {
    let total = 0;
    if (config?.enviar_nfe_email) total += 1;
    if (config?.enviar_emails) total += 1;
    if (config?.ativar_site_rastreio) total += 0.25;
    if (config?.ativar_taxacao) total += 1;
    return total;
  })();

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
                  <Label className="font-medium">Nota Fiscal enviada por email</Label>
                  <p className="text-xs text-muted-foreground">Envia automaticamente a Nota Fiscal por email ao cliente.</p>
                  <Badge variant="outline" className="mt-1 text-xs">1 moeda</Badge>
                </div>
                <Switch
                  checked={config.enviar_nfe_email}
                  onCheckedChange={() => toggleConfig.mutate("enviar_nfe_email")}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Fluxo do Rastreio por E-mail</Label>
                  <p className="text-xs text-muted-foreground">Envia emails automáticos de atualização de status do rastreio.</p>
                  <Badge variant="outline" className="mt-1 text-xs">1 moeda</Badge>
                </div>
                <Switch
                  checked={config.enviar_emails}
                  onCheckedChange={() => toggleConfig.mutate("enviar_emails")}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div>
                    <Label className="font-medium">Site do rastreio por SMS</Label>
                    <p className="text-xs text-muted-foreground">Envia o link do site de rastreio personalizado ao cliente por SMS.</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge variant="outline" className="text-xs">+0,25 moeda</Badge>
                      <Badge variant="secondary" className="text-xs">em breve</Badge>
                    </div>
                  </div>
                </div>
                <Switch
                  checked={config.ativar_site_rastreio}
                  onCheckedChange={() => toggleConfig.mutate("ativar_site_rastreio")}
                  disabled
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Funil de Taxação</Label>
                  <p className="text-xs text-muted-foreground">Ativa o fluxo de taxação com envio de Email e SMS ao cliente.</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge variant="outline" className="text-xs">+1 moeda</Badge>
                    <Badge variant="secondary" className="text-xs">em breve</Badge>
                  </div>
                </div>
                <Switch
                  checked={config.ativar_taxacao}
                  onCheckedChange={() => toggleConfig.mutate("ativar_taxacao")}
                  disabled
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
                  className={`transition-colors ${isAdmin ? "cursor-pointer hover:border-primary/50" : "opacity-80"}`}
                  onClick={isAdmin ? () => applyTemplate.mutate(template.id) : undefined}
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
            {isAdmin && config?.template_ativo_id && (
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
              {sortedActiveEventos?.map((evento, index) => {
                const Icon = iconMap[evento.status_label || ""] || Mail;
                const color = badgeColor[evento.status_label || ""] || "bg-muted text-muted-foreground";
                const isFirst = index === 0;

                return (
                  <Card key={evento.id} className={isFirst ? "border-green-200 bg-green-50/30" : ""}>
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
                      {!isFirst && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isAdmin ? (
                            <Input
                              type="number"
                              min={0}
                              className="w-16 h-8 text-xs text-center"
                              value={Math.round(evento.delay_horas / 24)}
                              onChange={(e) => {
                                const dias = parseInt(e.target.value) || 0;
                                updateEvento.mutate({ id: evento.id, delay_horas: dias * 24 });
                              }}
                            />
                          ) : (
                            <span className="text-xs font-medium">{Math.round(evento.delay_horas / 24)}</span>
                          )}
                          <span className="text-xs text-muted-foreground whitespace-nowrap">dias após anterior</span>
                        </div>
                      )}
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(evento)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          {!isFirst && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => deleteEvento.mutate(evento.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Custo estimado */}
        {config && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex items-center gap-2 mb-3">
                <Coins className="h-5 w-5 text-primary" />
                <p className="text-sm font-medium">Custo por Envio</p>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className={config.enviar_nfe_email ? "text-foreground" : "text-muted-foreground line-through"}>NF por email</span>
                  <span className={config.enviar_nfe_email ? "font-medium" : "text-muted-foreground"}>1 moeda</span>
                </div>
                <div className="flex justify-between">
                  <span className={config.enviar_emails ? "text-foreground" : "text-muted-foreground line-through"}>Rastreio por email</span>
                  <span className={config.enviar_emails ? "font-medium" : "text-muted-foreground"}>1 moeda</span>
                </div>
                <div className="flex justify-between">
                  <span className={config.ativar_site_rastreio ? "text-foreground" : "text-muted-foreground line-through"}>Site rastreio por SMS</span>
                  <span className={config.ativar_site_rastreio ? "font-medium" : "text-muted-foreground"}>+0,25 moeda</span>
                </div>
                <div className="flex justify-between">
                  <span className={config.ativar_taxacao ? "text-foreground" : "text-muted-foreground line-through"}>Funil de Taxação</span>
                  <span className={config.ativar_taxacao ? "font-medium" : "text-muted-foreground"}>+1 moeda</span>
                </div>
                <div className="border-t pt-2 mt-2 flex justify-between">
                  <span className="font-semibold">Total por envio</span>
                  <span className="text-lg font-bold text-primary">{custoMoedas} {custoMoedas === 1 ? "moeda" : "moedas"}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Email Editor */}
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
    </AppLayout>
  );
}
