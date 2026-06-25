import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Zap,
  MessageSquare,
  Globe,
  BarChart3,
  ExternalLink,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ── Types ──
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
  ativar_vizinho: boolean;
  origem_cidade: string | null;
  origem_estado: string | null;
  whatsapp_vendedor: string | null;
  cor_primaria: string | null;
  cor_botao_cta: string | null;
}

const ESTADOS_BR = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

// ── Helpers ──
function formatMoedas(value: number): string {
  const formatted = value % 1 === 0
    ? String(value)
    : value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${formatted} ${value === 1 ? "moeda" : "moedas"}`;
}

const iconMap: Record<string, React.ElementType> = {
  "Postado": FileText,
  "Coletado": Package,
  "Em Trânsito": Truck,
  "Centro Local": MapPin,
  "Saiu para Entrega": Truck,
  "Entregue": CheckCircle2,
  "Em Rota": Truck,
};

const badgeColor: Record<string, string> = {
  "Postado": "bg-primary/20 text-primary",
  "Coletado": "bg-accent text-accent-foreground",
  "Em Trânsito": "bg-primary/25 text-primary",
  "Centro Local": "bg-accent text-accent-foreground",
  "Saiu para Entrega": "bg-primary/30 text-primary",
  "Entregue": "bg-primary/15 text-primary",
  "Em Rota": "bg-primary/25 text-primary",
};

function isEventoAtivo(evento: PostagemEvento, localConfig: PostagemConfig): boolean {
  if (evento.enviar_nfe_pdf) return localConfig.enviar_nfe_email;
  return localConfig.enviar_emails;
}

function DelayInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [local, setLocal] = useState(String(Math.round(value / 24)));
  useEffect(() => { setLocal(String(Math.round(value / 24))); }, [value]);
  return (
    <Input
      type="number"
      min={0}
      className="w-14 h-7 text-xs text-center bg-transparent border-border/50"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const dias = parseInt(local) || 0;
        onChange(dias * 24);
      }}
    />
  );
}

// ── Main Component ──
export default function Postagens() {
  const { loja } = useLoja();
  const queryClient = useQueryClient();

  const [localConfig, setLocalConfig] = useState<PostagemConfig | null>(null);
  const [localDelays, setLocalDelays] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState("configuracao");

  // ── Queries ──
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

  const { data: systemEventos } = useQuery({
    queryKey: ["postagem-eventos-system", systemTemplates?.map((t) => t.id).join(",")],
    queryFn: async () => {
      const ids = (systemTemplates ?? []).map((t) => t.id);
      if (ids.length === 0) return [] as PostagemEvento[];
      const { data, error } = await supabase
        .from("postagem_eventos")
        .select("*")
        .in("template_id", ids)
        .order("ordem");
      if (error) throw error;
      return data as PostagemEvento[];
    },
    enabled: !!systemTemplates && systemTemplates.length > 0,
  });


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

  const { data: activeTemplate } = useQuery({
    queryKey: ["postagem-template-active", config?.template_ativo_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("postagem_templates")
        .select("*")
        .eq("id", config!.template_ativo_id!)
        .single();
      if (error) throw error;
      return data as PostagemTemplate;
    },
    enabled: !!config?.template_ativo_id,
  });

  const { data: systemConfigValues } = useQuery({
    queryKey: ["system-config", loja?.user_id],
    queryFn: async () => {
      const { data: sysData, error: sysError } = await supabase
        .from("system_config")
        .select("key, value");
      if (sysError) throw sysError;

      let customPrices: Record<string, number> = {};
      if (loja?.user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("custom_prices")
          .eq("id", loja.user_id)
          .single();
        if (profile?.custom_prices) {
          customPrices = profile.custom_prices as Record<string, number>;
        }
      }

      const map: Record<string, number> = {};
      (sysData || []).forEach((r: { key: string; value: number }) => {
        map[r.key] = customPrices[r.key] !== undefined ? Number(customPrices[r.key]) : Number(r.value);
      });
      return map;
    },
  });

  // ── Sync local state ──
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

  // ── Derived state ──
  const hasChanges = useMemo(() => {
    if (!config || !localConfig) return false;
    const configChanged =
      config.enviar_emails !== localConfig.enviar_emails ||
      config.enviar_nfe_email !== localConfig.enviar_nfe_email ||
      config.ativar_site_rastreio !== localConfig.ativar_site_rastreio ||
      (config as any).origem_cidade !== localConfig.origem_cidade ||
      (config as any).origem_estado !== localConfig.origem_estado ||
      (config as any).whatsapp_vendedor !== localConfig.whatsapp_vendedor ||
      (config as any).cor_primaria !== localConfig.cor_primaria ||
      (config as any).cor_botao_cta !== localConfig.cor_botao_cta ||
      (config as any).ativar_vizinho !== localConfig.ativar_vizinho;
    const delaysChanged = activeEventos?.some(
      e => localDelays[e.id] !== undefined && localDelays[e.id] !== e.delay_horas
    );
    return configChanged || !!delaysChanged;
  }, [config, localConfig, activeEventos, localDelays]);

  const sortedActiveEventos = activeEventos?.slice().sort((a, b) => a.ordem - b.ordem);

  // Count SMS events — exclude NF-e
  const smsEventCount = useMemo(() => {
    if (!sortedActiveEventos || !localConfig) return 0;
    return sortedActiveEventos.filter(e => !e.enviar_nfe_pdf).length;
  }, [sortedActiveEventos, localConfig]);

  const smsCostUnit = systemConfigValues?.custo_sms_rastreio ?? 0.25;
  const smsTotalCost = smsEventCount * smsCostUnit;

  const custoMoedas = (() => {
    if (!localConfig || !systemConfigValues) return 0;
    let total = 0;
    if (localConfig.enviar_nfe_email) total += systemConfigValues.custo_nfe_email ?? 1;
    if (localConfig.enviar_emails) total += systemConfigValues.custo_email_rastreio ?? 1;
    if (localConfig.ativar_site_rastreio) total += smsTotalCost;
    return total;
  })();

  // ── Mutations ──
  const applyTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      if (!loja) return;
      const systemTemplate = systemTemplates?.find((t) => t.id === templateId);
      if (!systemTemplate) return;
      const evts = systemEventos?.filter((e) => e.template_id === templateId) || [];

      // Freeze: stamp the OLD template only on shipments already in progress (ordem >= 2),
      // so newly-arrived pending orders pick up the NEW template instead of being locked
      // into the previous one.
      const oldTemplateId = config?.template_ativo_id;
      if (oldTemplateId) {
        await supabase
          .from("envios")
          .update({ postagem_template_id: oldTemplateId })
          .eq("loja_id", loja.id)
          .is("postagem_template_id", null)
          .neq("status", "entregue")
          .gte("ultimo_evento_ordem", 2)
          .is("deleted_at", null);
      }

      // Reuse an existing non-system copy of this tipo for this loja if one already exists,
      // otherwise create a fresh copy. Avoids accumulating duplicate template rows.
      const { data: existingCopies } = await supabase
        .from("postagem_templates")
        .select("id")
        .eq("loja_id", loja.id)
        .eq("tipo", systemTemplate.tipo)
        .eq("is_system", false)
        .order("created_at", { ascending: false })
        .limit(1);

      let activeTemplateId: string;

      if (existingCopies && existingCopies.length > 0) {
        // Reuse: wipe its events and re-seed from the system template
        activeTemplateId = existingCopies[0].id;
        await supabase.from("postagem_eventos").delete().eq("template_id", activeTemplateId);
      } else {
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
        activeTemplateId = newTemplate.id;
      }

      if (evts.length > 0) {
        const { error: eErr } = await supabase.from("postagem_eventos").insert(
          evts.map((e) => ({
            template_id: activeTemplateId,
            loja_id: loja.id,
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
          template_ativo_id: activeTemplateId,
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
    onError: (err: any) => {
      console.error("[applyTemplate] erro:", err);
      toast({
        title: "Erro ao aplicar template",
        description: err?.message || "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    },
  });

  const saveAll = useMutation({
    mutationFn: async () => {
      if (!loja || !localConfig) throw new Error("Dados não disponíveis");

      const { error: configErr } = await supabase
        .from("postagem_config")
        .update({
          enviar_emails: localConfig.enviar_emails,
          enviar_nfe_email: localConfig.enviar_nfe_email,
          ativar_site_rastreio: localConfig.ativar_site_rastreio,
          ativar_vizinho: localConfig.ativar_vizinho,
          origem_cidade: localConfig.origem_cidade,
          origem_estado: localConfig.origem_estado,
          whatsapp_vendedor: localConfig.whatsapp_vendedor || null,
          cor_primaria: localConfig.cor_primaria || '#6366f1',
          cor_botao_cta: localConfig.cor_botao_cta || '#1a1a1a',
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

  // ── Feature toggles data ──
  const featureToggles = localConfig ? [
    {
      key: "enviar_nfe_email",
      label: "Nota Fiscal por E-mail",
      desc: "Envia automaticamente a NF-e por email ao cliente.",
      icon: FileText,
      checked: localConfig.enviar_nfe_email,
      cost: systemConfigValues?.custo_nfe_email ?? 1,
      toggle: () => setLocalConfig(prev => prev ? { ...prev, enviar_nfe_email: !prev.enviar_nfe_email } : prev),
    },
    {
      key: "enviar_emails",
      label: "Rastreio por E-mail",
      desc: "Emails automáticos de atualização de status.",
      icon: Mail,
      checked: localConfig.enviar_emails,
      cost: systemConfigValues?.custo_email_rastreio ?? 1,
      toggle: () => setLocalConfig(prev => prev ? { ...prev, enviar_emails: !prev.enviar_emails } : prev),
    },
    {
      key: "ativar_site_rastreio",
      label: "Envio de Etapas por SMS",
      desc: "Cobrado individualmente por SMS enviado.",
      icon: Globe,
      checked: localConfig.ativar_site_rastreio,
      cost: systemConfigValues?.custo_sms_rastreio ?? 0.25,
      costSuffix: "/SMS",
      toggle: () => setLocalConfig(prev => prev ? { ...prev, ativar_site_rastreio: !prev.ativar_site_rastreio } : prev),
    },
    {
      key: "ativar_vizinho",
      label: "Recebido por Vizinho",
      desc: localConfig.ativar_vizinho
        ? "Mostra dados fictícios de um vizinho como recebedor na entrega."
        : 'Exibe apenas "Pedido entregue ao destinatário" sem dados de vizinho.',
      icon: CheckCircle2,
      checked: localConfig.ativar_vizinho ?? true,
      cost: 0,
      toggle: () => setLocalConfig(prev => prev ? { ...prev, ativar_vizinho: !prev.ativar_vizinho } : prev),
    },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Postagens</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure os fluxos de email automáticos para cada evento de rastreamento.
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="glass glow-border p-1 h-auto">
          <TabsTrigger value="configuracao" className="flex items-center gap-1.5 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Settings2 className="h-3.5 w-3.5" />
            Configuração
          </TabsTrigger>
          <TabsTrigger value="logistica" className="flex items-center gap-1.5 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Truck className="h-3.5 w-3.5" />
            Logística
          </TabsTrigger>
        </TabsList>

        {/* ─── Configuração Tab ─── */}
        <TabsContent value="configuracao" className="space-y-6 mt-5">

          {/* Feature Toggles Grid */}
          {localConfig && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {featureToggles.map((ft, idx) => {
                const locked = (ft as any).locked as boolean | undefined;
                const lockedReason = (ft as any).lockedReason as string | undefined;
                return (
                  <div
                    key={ft.key}
                    className={`glass rounded-xl p-4 transition-all duration-300 animate-stagger-in ${ft.checked ? "glow-border" : "border border-border/30"} ${locked ? "opacity-60" : ""}`}
                    style={{ animationDelay: `${idx * 0.06}s` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${ft.checked ? "bg-primary/15" : "bg-muted/50"}`}>
                          <ft.icon className={`h-4 w-4 ${ft.checked ? "text-primary" : "text-muted-foreground"}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{ft.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{ft.desc}</p>
                          <Badge variant="outline" className="mt-1.5 text-[10px] border-border/50">
                            <Coins className="h-2.5 w-2.5 mr-1" />
                            {formatMoedas(ft.cost)}{(ft as any).costSuffix || ""}
                          </Badge>
                          {locked && lockedReason && (
                            <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              {lockedReason}
                            </p>
                          )}
                        </div>
                      </div>
                      <Switch
                        checked={ft.checked}
                        onCheckedChange={ft.toggle}
                        disabled={locked}
                        title={locked ? lockedReason : undefined}
                      />
                    </div>
                  </div>
                );
              })}

            </div>
          )}

          {/* WhatsApp Vendedor */}
          {localConfig && (
            <div className={`glass rounded-xl p-5 animate-stagger-in transition-all duration-300 ${localConfig.whatsapp_vendedor ? "glow-border" : "border border-border/30"}`} style={{ animationDelay: "0.22s" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${localConfig.whatsapp_vendedor ? "bg-[#25D366]/15" : "bg-muted/50"}`}>
                    <MessageSquare className={`h-4 w-4 ${localConfig.whatsapp_vendedor ? "text-[#25D366]" : "text-muted-foreground"}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Botão WhatsApp no E-mail</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Adiciona botão "Fale Com o Vendedor" em todos os e-mails enviados ao cliente</p>
                  </div>
                </div>
                <Switch
                  checked={!!localConfig.whatsapp_vendedor}
                  onCheckedChange={(checked) => setLocalConfig(prev => prev ? { ...prev, whatsapp_vendedor: checked ? "" : null } : prev)}
                />
              </div>
              {localConfig.whatsapp_vendedor !== null && (
                <div className="mt-3 ml-12">
                  <Label className="text-xs text-muted-foreground">Número com DDI (ex: 5511999999999)</Label>
                  <Input
                    placeholder="5511999999999"
                    value={localConfig.whatsapp_vendedor || ""}
                    onChange={(e) => setLocalConfig(prev => prev ? { ...prev, whatsapp_vendedor: e.target.value } : prev)}
                    className="mt-1"
                  />
                </div>
              )}
            </div>
          )}


          {/* Origem de Envio */}
          {localConfig && (
            <div className="glass glow-border rounded-xl p-5 animate-stagger-in" style={{ animationDelay: "0.25s" }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Origem de Envio</p>
                  <p className="text-xs text-muted-foreground">Cidade de onde os pedidos saem para entrega</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Estado</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={localConfig.origem_estado || ""}
                    onChange={(e) => setLocalConfig(prev => prev ? { ...prev, origem_estado: e.target.value || null } : prev)}
                  >
                    <option value="">Selecione o estado</option>
                    {ESTADOS_BR.map(uf => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Cidade</Label>
                  <Input
                    placeholder="Ex: Rio de Janeiro"
                    value={localConfig.origem_cidade || ""}
                    onChange={(e) => setLocalConfig(prev => prev ? { ...prev, origem_cidade: e.target.value || null } : prev)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Templates */}
          <div>
            <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Templates Pré-configurados
            </h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {systemTemplates?.map((template, idx) => {
                const evts = systemEventos?.filter((e) => e.template_id === template.id) || [];
                const isActive = activeTemplate?.tipo === template.tipo;

                return (
                  <div
                    key={template.id}
                    className={cn(
                      "glass rounded-xl p-4 cursor-pointer transition-all duration-300 hover:scale-[1.02] animate-stagger-in relative overflow-hidden",
                      isActive ? "glow-border ring-1 ring-primary/50 shadow-lg shadow-primary/10" : "glow-border-hover border border-border/30"
                    )}
                    style={{ animationDelay: `${(idx + 4) * 0.06}s` }}
                    onClick={() => !isActive && applyTemplate.mutate(template.id)}
                  >
                    {isActive && (
                      <div className="absolute top-0 right-0">
                        <div className="bg-primary text-primary-foreground text-[8px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-tighter">
                          Ativo
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{template.nome}</p>
                        {isActive && <CheckCircle2 className="h-3 w-3 text-primary" />}
                      </div>
                      <Badge variant="secondary" className="text-[10px]">
                        {evts.length} eventos
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{template.descricao}</p>
                    <div className="flex flex-wrap gap-1">
                      {evts.map((e) => {
                        // Determine if this event's group is active based on config
                        let evtAtivo = true;
                        if (localConfig) {
                          if (e.enviar_nfe_pdf) evtAtivo = localConfig.enviar_nfe_email;
                        }
                        const activeColor = evtAtivo
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-destructive/20 text-destructive line-through opacity-70";
                        return (
                          <span key={e.id} className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${activeColor}`}>
                            {e.status_label}
                          </span>
                        );
                      })}
                    </div>
                    {!isActive && (
                      <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        Aplicar substituirá eventos atuais
                      </p>
                    )}
                    {isActive && (
                      <p className="text-[10px] text-primary font-medium mt-2 flex items-center gap-1">
                        <Zap className="h-2.5 w-2.5" />
                        Este é o seu fluxo atual
                      </p>
                    )}
                  </div>
                );
              })}

              {/* Placeholder: Envio Intermediário (Em Breve) */}
              <div
                className="glass rounded-xl p-4 relative overflow-hidden border border-border/30 opacity-60 cursor-not-allowed animate-stagger-in"
                style={{ animationDelay: `${((systemTemplates?.length ?? 0) + 4) * 0.06}s` }}
              >
                <div className="absolute top-0 right-0">
                  <div className="bg-muted text-muted-foreground text-[8px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-tighter">
                    Em Breve
                  </div>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-foreground">Envio Intermediário</p>
                  <Badge variant="secondary" className="text-[10px]">11 eventos</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">Fluxo intermediário com 11 eventos.</p>
                <div className="flex flex-wrap gap-1">
                  {[
                    "NF-e","Postado","Coletado","Em Trânsito","Centro de Distribuição",
                    "Passando por triagem","Em redistribuição","Unidade final",
                    "Saiu para Entrega","Em rota final","Entregue",
                  ].map((label) => (
                    <span key={label} className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-muted/40 text-muted-foreground">
                      {label}
                    </span>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  Disponível em breve
                </p>
              </div>
            </div>
          </div>

          {/* Active Flow Events */}
          <div>
            <div className="mb-3">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Eventos do Fluxo Ativo
              </h2>
              <p className="text-[11px] text-muted-foreground mt-1 ml-6">
                Os dias configurados representam o intervalo a partir do último evento concluído.
              </p>
            </div>

            {!config?.template_ativo_id ? (
              <div className="glass glow-border rounded-xl flex flex-col items-center justify-center py-16 text-center">
                <div className="relative mb-4">
                  <div className="h-16 w-16 rounded-full bg-primary/5 flex items-center justify-center">
                    <Box className="h-8 w-8 text-primary/30" />
                  </div>
                  <div className="absolute inset-0 animate-orbit">
                    <div className="h-2 w-2 rounded-full bg-primary/30 animate-pulse-dot" />
                  </div>
                </div>
                <p className="text-foreground font-medium">Selecione um template acima</p>
                <p className="text-xs text-muted-foreground mt-1">Escolha um fluxo pré-configurado para começar.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedActiveEventos?.map((evento, index) => {
                  const Icon = iconMap[evento.status_label || ""] || Mail;
                  const isFirst = index === 0;
                  const ativo = localConfig ? isEventoAtivo(evento, localConfig) : false;
                  const color = ativo
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-destructive/20 text-destructive";

                  return (
                    <div
                      key={evento.id}
                      className={`glass rounded-xl transition-all duration-300 animate-stagger-in ${ativo ? "border border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.15)]" : "border border-destructive/40 shadow-[0_0_8px_rgba(239,68,68,0.15)] opacity-60"}`}
                      style={{ animationDelay: `${index * 0.04}s` }}
                    >
                      <div className="flex items-center gap-3 py-3 px-4">
                        <GripVertical className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${ativo ? "bg-primary/10" : "bg-muted/30"}`}>
                          <Icon className={`h-3.5 w-3.5 ${ativo ? "text-primary" : "text-muted-foreground/50"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-foreground">{evento.nome}</span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${color}`}>
                              {evento.status_label}
                            </span>
                            {evento.is_final && (
                              <Badge variant="outline" className="text-[10px] border-border/50">Final</Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">{evento.descricao}</p>
                          <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                            {evento.enviar_email && (
                              <span className={`flex items-center gap-0.5 ${ativo ? "text-emerald-400" : "text-destructive/70"}`}>
                                <Mail className="h-2.5 w-2.5" /> Email
                              </span>
                            )}
                            {evento.enviar_nfe_pdf && (
                              <span className={`flex items-center gap-0.5 ${ativo ? "text-emerald-400" : "text-destructive/70"}`}>
                                <FileText className="h-2.5 w-2.5" /> NFe
                              </span>
                            )}
                            {!evento.enviar_nfe_pdf && localConfig?.ativar_site_rastreio && (
                              <span className={`flex items-center gap-0.5 ${ativo ? "text-emerald-400" : "text-destructive/70"}`}>
                                <MessageSquare className="h-2.5 w-2.5" /> SMS
                              </span>
                            )}
                          </div>
                        </div>
                        {!isFirst && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Clock className="h-3 w-3 text-muted-foreground/50" />
                            <DelayInput
                              value={localDelays[evento.id] ?? evento.delay_horas}
                              onChange={(delay_horas) => setLocalDelays(prev => ({ ...prev, [evento.id]: delay_horas }))}
                            />
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">dias após último evento</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Save Button */}
                <div className="pt-3">
                  <Button
                    onClick={() => saveAll.mutate()}
                    disabled={!hasChanges || saveAll.isPending}
                    className="w-full shimmer-btn"
                    size="lg"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saveAll.isPending ? "Salvando..." : "Salvar Alterações"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Cost Summary */}
          {localConfig && (
            <div className="glass glow-border rounded-xl p-5 animate-stagger-in" style={{ animationDelay: "0.3s" }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Coins className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">Custo por Envio</p>
              </div>
              <div className="space-y-2 text-sm">
                {[
                  { label: "NF por email", active: localConfig.enviar_nfe_email, cost: systemConfigValues?.custo_nfe_email ?? 1, display: formatMoedas(systemConfigValues?.custo_nfe_email ?? 1) },
                  { label: "Rastreio por email", active: localConfig.enviar_emails, cost: systemConfigValues?.custo_email_rastreio ?? 1, display: formatMoedas(systemConfigValues?.custo_email_rastreio ?? 1) },
                  { label: `SMS (${smsEventCount}x ${formatMoedas(smsCostUnit)})`, active: localConfig.ativar_site_rastreio, cost: smsTotalCost, display: formatMoedas(smsTotalCost), prefix: "+" },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between">
                    <span className={item.active ? "text-foreground" : "text-muted-foreground line-through"}>{item.label}</span>
                    <span className={item.active ? "font-medium text-foreground" : "text-muted-foreground"}>
                      {item.prefix || ""}{item.display}
                    </span>
                  </div>
                ))}
                <div className="border-t border-border/30 pt-2 mt-2 flex justify-between">
                  <span className="font-semibold">Total por envio</span>
                  <span className="text-lg font-bold text-primary">{formatMoedas(custoMoedas)}</span>
                </div>
              </div>
            </div>
          )}
        </TabsContent>


        {/* ─── Logística Tab ─── */}
        <TabsContent value="logistica" className="mt-5">
          <LogisticaTab lojaId={loja?.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─── Logística Sub-component ─── */
function LogisticaTab({ lojaId }: { lojaId?: string }) {
  const queryClient = useQueryClient();

  const { data: logisticaProvider = "jl" } = useQuery({
    queryKey: ["loja-logistica", lojaId],
    queryFn: async () => {
      if (!lojaId) return "atlas";
      const { data, error } = await supabase
        .from("lojas")
        .select("logistica_provider")
        .eq("id", lojaId)
        .single();
      if (error) throw error;
      return data?.logistica_provider || "atlas";
    },
    enabled: !!lojaId,
  });

  const mutation = useMutation({
    mutationFn: async (provider: string) => {
      if (!lojaId) return;
      const { error } = await supabase
        .from("lojas")
        .update({ logistica_provider: provider })
        .eq("id", lojaId);
      if (error) throw error;
      return provider;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loja-logistica", lojaId] });
      toast({ title: "Logística padrão atualizada!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao atualizar: " + err.message, variant: "destructive" });
    },
  });

  const providers = [
    { id: "atlas", label: "Atlas Transportes", short: "ATLAS", site: "https://app.atlas-cargo.org" },
    { id: "jetline", label: "JetLine Logística", short: "JETLINE", site: "https://app.jetlinetransportes.com" },
  ];

  const active = providers.find((p) => p.id === logisticaProvider) ?? providers[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Truck className="h-4 w-4" />
          Logística de Envios
        </CardTitle>
        <CardDescription>Transportadora padrão utilizada para os novos pedidos desta loja.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm text-foreground">
            Transportadora ativa: <strong className="text-primary">{active.label}</strong>
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {providers.map((p) => {
            const isActive = logisticaProvider === p.id;
            return (
              <button
                key={p.id}
                onClick={() => mutation.mutate(p.id)}
                disabled={mutation.isPending}
                className={`flex flex-col items-center justify-center p-8 border-2 rounded-xl transition-all bg-white ${
                  isActive ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40"
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Truck className={`h-10 w-10 ${isActive ? "text-primary" : "text-slate-500"}`} />
                  <span className="text-3xl font-extrabold tracking-wider text-slate-800">{p.short}</span>
                </div>
                <span className={`font-semibold text-sm ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                  {p.label}
                </span>
                <a
                  href={p.site}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="mt-3 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
                >
                  Visitar site <ExternalLink className="h-3 w-3" />
                </a>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
