import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Mail,
  Package,
  Truck,
  CheckCircle2,
  FileText,
  Clock,
  GripVertical,
  AlertTriangle,
  Coins,
  MapPin,
  CreditCard,
  Box,
  Save,
  Settings2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { TaxacaoConfig } from "@/components/postagens/TaxacaoConfig";

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

function isEventoAtivo(evento: PostagemEvento, localConfig: PostagemConfig): boolean {
  if (evento.enviar_nfe_pdf) return localConfig.enviar_nfe_email;
  if (evento.status_label === "Taxação" || evento.status_label === "Pago")
    return localConfig.ativar_taxacao;
  return localConfig.enviar_emails;
}

function DelayInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [local, setLocal] = useState(String(Math.round(value / 24)));
  useEffect(() => { setLocal(String(Math.round(value / 24))); }, [value]);
  return (
    <Input
      type="number"
      min={0}
      className="w-16 h-8 text-xs text-center"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const dias = parseInt(local) || 0;
        onChange(dias * 24);
      }}
    />
  );
}

export default function Postagens() {
  const { loja } = useLoja();
  const queryClient = useQueryClient();

  // Local state for manual save
  const [localConfig, setLocalConfig] = useState<PostagemConfig | null>(null);
  const [localDelays, setLocalDelays] = useState<Record<string, number>>({});

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

  // Sync local state from server data
  useEffect(() => {
    if (config) setLocalConfig({ ...config });
  }, [config]);

  useEffect(() => {
    if (activeEventos) {
      const delays: Record<string, number> = {};
      activeEventos.forEach(e => { delays[e.id] = e.delay_horas; });
      setLocalDelays(delays);
    }
  }, [activeEventos]);

  // Detect pending changes
  const hasChanges = useMemo(() => {
    if (!config || !localConfig) return false;
    const configChanged =
      config.enviar_emails !== localConfig.enviar_emails ||
      config.enviar_nfe_email !== localConfig.enviar_nfe_email ||
      config.ativar_site_rastreio !== localConfig.ativar_site_rastreio ||
      config.ativar_taxacao !== localConfig.ativar_taxacao;
    const delaysChanged = activeEventos?.some(
      e => localDelays[e.id] !== undefined && localDelays[e.id] !== e.delay_horas
    );
    return configChanged || !!delaysChanged;
  }, [config, localConfig, activeEventos, localDelays]);

  // Apply template mutation
  const applyTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      if (!loja) return;

      const systemTemplate = systemTemplates?.find((t) => t.id === templateId);
      if (!systemTemplate) return;

      const evts = systemEventos?.filter((e) => e.template_id === templateId) || [];

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

  // Save all changes mutation
  const saveAll = useMutation({
    mutationFn: async () => {
      if (!loja || !localConfig) throw new Error("Dados não disponíveis");

      const { error: configErr } = await supabase
        .from("postagem_config")
        .update({
          enviar_emails: localConfig.enviar_emails,
          enviar_nfe_email: localConfig.enviar_nfe_email,
          ativar_site_rastreio: localConfig.ativar_site_rastreio,
          ativar_taxacao: localConfig.ativar_taxacao,
        })
        .eq("loja_id", loja.id);
      if (configErr) throw configErr;

      if (activeEventos) {
        for (const evento of activeEventos) {
          if (localDelays[evento.id] !== undefined && localDelays[evento.id] !== evento.delay_horas) {
            const { error } = await supabase
              .from("postagem_eventos")
              .update({ delay_horas: localDelays[evento.id] })
              .eq("id", evento.id);
            if (error) throw error;
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["postagem-config"] });
      queryClient.invalidateQueries({ queryKey: ["postagem-eventos-active"] });
      toast({ title: "Configurações salvas com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao salvar configurações", variant: "destructive" });
    },
  });

  const sortedActiveEventos = activeEventos?.slice().sort((a, b) => a.ordem - b.ordem);

  // Fetch system config values
  const { data: systemConfigValues } = useQuery({
    queryKey: ["system-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_config")
        .select("key, value");
      if (error) throw error;
      const map: Record<string, number> = {};
      (data || []).forEach((r: { key: string; value: number }) => { map[r.key] = Number(r.value); });
      return map;
    },
  });

  const custoMoedas = (() => {
    if (!localConfig || !systemConfigValues) return 0;
    let total = 0;
    if (localConfig.enviar_nfe_email) total += systemConfigValues.custo_nfe_email ?? 1;
    if (localConfig.enviar_emails) total += systemConfigValues.custo_email_rastreio ?? 1;
    if (localConfig.ativar_site_rastreio) total += systemConfigValues.custo_sms_rastreio ?? 0.25;
    if (localConfig.ativar_taxacao) total += systemConfigValues.custo_taxacao ?? 1;
    return total;
  })();

  const [activeTab, setActiveTab] = useState("configuracao");

  return (
    <>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Postagens</h1>
            <p className="text-muted-foreground">
              Gerencie os fluxos de email automáticos para cada evento de rastreamento
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="configuracao" className="flex items-center gap-1.5">
              <Settings2 className="h-3.5 w-3.5" />
              Configuração
            </TabsTrigger>
            <TabsTrigger value="taxacao" className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Taxação
              {localConfig?.ativar_taxacao && (
                <span className="ml-1 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </TabsTrigger>
          </TabsList>

          {/* ─── Configuração Tab ─── */}
          <TabsContent value="configuracao" className="space-y-6 mt-4">
            {/* Configurações gerais */}
            {localConfig && (
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
                      checked={localConfig.enviar_nfe_email}
                      onCheckedChange={() => setLocalConfig(prev => prev ? { ...prev, enviar_nfe_email: !prev.enviar_nfe_email } : prev)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Fluxo do Rastreio por E-mail</Label>
                      <p className="text-xs text-muted-foreground">Envia emails automáticos de atualização de status do rastreio.</p>
                      <Badge variant="outline" className="mt-1 text-xs">1 moeda</Badge>
                    </div>
                    <Switch
                      checked={localConfig.enviar_emails}
                      onCheckedChange={() => setLocalConfig(prev => prev ? { ...prev, enviar_emails: !prev.enviar_emails } : prev)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div>
                        <Label className="font-medium">Site do rastreio por SMS</Label>
                        <p className="text-xs text-muted-foreground">Envia o link do site de rastreio personalizado ao cliente por SMS.</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge variant="outline" className="text-xs">+0,25 moeda</Badge>
                        </div>
                      </div>
                    </div>
                    <Switch
                      checked={localConfig.ativar_site_rastreio}
                      onCheckedChange={() => setLocalConfig(prev => prev ? { ...prev, ativar_site_rastreio: !prev.ativar_site_rastreio } : prev)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Funil de Taxação</Label>
                      <p className="text-xs text-muted-foreground">Ativa o fluxo de taxação com envio de Email e SMS ao cliente.</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge variant="outline" className="text-xs">+1 moeda</Badge>
                      </div>
                    </div>
                    <Switch
                      checked={localConfig.ativar_taxacao}
                      onCheckedChange={() => setLocalConfig(prev => prev ? { ...prev, ativar_taxacao: !prev.ativar_taxacao } : prev)}
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

                  return (
                    <Card
                      key={template.id}
                      className="cursor-pointer transition-colors hover:border-primary/50"
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

            {/* Eventos do fluxo ativo */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-foreground">Eventos do Fluxo Ativo</h2>
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
                    const ativo = localConfig ? isEventoAtivo(evento, localConfig) : false;

                    return (
                      <Card
                        key={evento.id}
                        className={ativo
                          ? "border-green-500/50 bg-green-50/30 dark:bg-green-950/20"
                          : "border-red-500/50 bg-red-50/30 dark:bg-red-950/20"
                        }
                      >
                        <CardContent className="flex items-center gap-4 py-3 px-4">
                          <GripVertical className="h-4 w-4 text-muted-foreground/40" />
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
                              <DelayInput
                                value={localDelays[evento.id] ?? evento.delay_horas}
                                onChange={(delay_horas) => setLocalDelays(prev => ({ ...prev, [evento.id]: delay_horas }))}
                              />
                              <span className="text-xs text-muted-foreground whitespace-nowrap">dias após anterior</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}

                  {/* Botão Salvar */}
                  <div className="pt-4">
                    <Button
                      onClick={() => saveAll.mutate()}
                      disabled={!hasChanges || saveAll.isPending}
                      className="w-full"
                      size="lg"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {saveAll.isPending ? "Salvando..." : "Salvar Alterações"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Custo estimado */}
            {localConfig && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Coins className="h-5 w-5 text-primary" />
                    <p className="text-sm font-medium">Custo por Envio</p>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className={localConfig.enviar_nfe_email ? "text-foreground" : "text-muted-foreground line-through"}>NF por email</span>
                      <span className={localConfig.enviar_nfe_email ? "font-medium" : "text-muted-foreground"}>1 moeda</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={localConfig.enviar_emails ? "text-foreground" : "text-muted-foreground line-through"}>Rastreio por email</span>
                      <span className={localConfig.enviar_emails ? "font-medium" : "text-muted-foreground"}>1 moeda</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={localConfig.ativar_site_rastreio ? "text-foreground" : "text-muted-foreground line-through"}>Site rastreio por SMS</span>
                      <span className={localConfig.ativar_site_rastreio ? "font-medium" : "text-muted-foreground"}>+0,25 moeda</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={localConfig.ativar_taxacao ? "text-foreground" : "text-muted-foreground line-through"}>Funil de Taxação</span>
                      <span className={localConfig.ativar_taxacao ? "font-medium" : "text-muted-foreground"}>+1 moeda</span>
                    </div>
                    <div className="border-t pt-2 mt-2 flex justify-between">
                      <span className="font-semibold">Total por envio</span>
                      <span className="text-lg font-bold text-primary">{custoMoedas} {custoMoedas === 1 ? "moeda" : "moedas"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ─── Taxação Tab ─── */}
          <TabsContent value="taxacao" className="mt-4">
            {loja?.id && (
              <TaxacaoConfig
                lojaId={loja.id}
                taxacaoAtivo={localConfig?.ativar_taxacao ?? false}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
