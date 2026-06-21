import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Globe2,
  Mail,
  MessageSquare,
  BadgeCheck,
  Save,
  Settings2,
  Coins,
  Sparkles,
  Languages,
  ShieldCheck,
  Check,
  ChevronsUpDown,
  Clock,
  GripVertical,
  ExternalLink,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { COUNTRIES, type Country } from "@/lib/countries";

type Lang = "en" | "es";

const STEPS: Record<Lang, string[]> = {
  en: [
    "Order Received",
    "Order Prepared",
    "Shipped by Sender",
    "Left Country of Origin",
    "In International Transit",
    "Arrived at Destination Country",
    "In Customs Processing",
    "In Local Transit",
    "Out for Delivery",
    "Delivered",
  ],
  es: [
    "Pedido Recibido",
    "Pedido Preparado",
    "Enviado por el Remitente",
    "Salió del País de Origen",
    "En Tránsito Internacional",
    "Llegó al País de Destino",
    "En Procesamiento Aduanero",
    "En Tránsito Local",
    "Salió para Entrega",
    "Entregado",
  ],
};

interface GlobalConfig {
  loja_id: string;
  ativo: boolean;
  idioma: Lang;
  enviar_email: boolean;
  enviar_sms: boolean;
  pais_origem: string;
  pais_origem_nome: string;
  confirmacao_email: boolean;
  confirmacao_sms: boolean;
}

interface GlobalEvento {
  id: string;
  loja_id: string;
  step_order: number;
  step_key: string;
  nome_pt: string;
  nome_en: string;
  nome_es: string;
  delay_horas: number;
}


function formatMoedas(value: number): string {
  const f = value % 1 === 0
    ? String(value)
    : value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${f} ${value === 1 ? "moeda" : "moedas"}`;
}

function DelayInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [local, setLocalVal] = useState(String(Math.round(value / 24)));
  useEffect(() => { setLocalVal(String(Math.round(value / 24))); }, [value]);
  return (
    <Input
      type="number"
      min={0}
      className="w-14 h-7 text-xs text-center bg-transparent border-border/50"
      value={local}
      onChange={(e) => setLocalVal(e.target.value)}
      onBlur={() => {
        const dias = parseInt(local) || 0;
        onChange(dias * 24);
      }}
    />
  );
}

function CountryPicker({ value, onChange, lang }: { value: string; onChange: (c: Country) => void; lang: Lang }) {
  const [open, setOpen] = useState(false);
  const selected = COUNTRIES.find((c) => c.code === value) || COUNTRIES[0];
  const nameKey = lang === "es" ? "name_es" : "name_en";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-14 text-base bg-card/50 border-border/60 hover:bg-card hover:border-primary/40"
        >
          <span className="flex items-center gap-3">
            <span className="text-2xl leading-none">{selected.flag}</span>
            <span className="font-medium">{selected[nameKey]}</span>
            <Badge variant="secondary" className="text-[10px] font-mono">{selected.code}</Badge>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar país..." />
          <CommandList>
            <CommandEmpty>Nenhum país encontrado.</CommandEmpty>
            <CommandGroup>
              {COUNTRIES.map((c) => (
                <CommandItem
                  key={c.code}
                  value={`${c.name_pt} ${c.name_en} ${c.name_es} ${c.code}`}
                  onSelect={() => { onChange(c); setOpen(false); }}
                  className="cursor-pointer"
                >
                  <span className="text-xl mr-2">{c.flag}</span>
                  <span className="flex-1">{c[nameKey]}</span>
                  <Badge variant="outline" className="text-[10px] font-mono mr-2">{c.code}</Badge>
                  <Check className={cn("h-4 w-4", c.code === value ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function Global() {
  const { loja } = useLoja();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("visao");
  const [local, setLocal] = useState<GlobalConfig | null>(null);
  const [localDelays, setLocalDelays] = useState<Record<string, number>>({});


  const { data: config, isLoading } = useQuery({
    queryKey: ["global-flow-config", loja?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("global_flow_config")
        .select("*")
        .eq("loja_id", loja!.id)
        .maybeSingle();
      return data as GlobalConfig | null;
    },
    enabled: !!loja?.id,
  });

  const { data: eventos } = useQuery({
    queryKey: ["global-flow-eventos", loja?.id],
    queryFn: async () => {
      if (!loja?.id) return [] as GlobalEvento[];
      // ensure seed exists for stores created before the trigger
      await supabase.rpc("seed_global_flow_eventos" as any, { _loja_id: loja.id });
      const { data } = await supabase
        .from("global_flow_eventos" as any)
        .select("*")
        .eq("loja_id", loja.id)
        .order("step_order");
      return (data || []) as unknown as GlobalEvento[];
    },
    enabled: !!loja?.id,
  });

  useEffect(() => {
    if (eventos && eventos.length) {
      const d: Record<string, number> = {};
      eventos.forEach((e) => { d[e.id] = e.delay_horas; });
      setLocalDelays(d);
    }
  }, [eventos]);


  const { data: custos } = useQuery({
    queryKey: ["system-config-global", loja?.user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_config")
        .select("key, value")
        .in("key", [
          "custo_global_flow_email",
          "custo_global_flow_sms",
          "custo_global_flow_confirmacao_email",
        ]);
      let custom: Record<string, number> = {};
      if (loja?.user_id) {
        const { data: p } = await supabase
          .from("profiles")
          .select("custom_prices")
          .eq("id", loja.user_id)
          .maybeSingle();
        if (p?.custom_prices) custom = p.custom_prices as Record<string, number>;
      }
      const map: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        map[r.key] = custom[r.key] !== undefined ? Number(custom[r.key]) : Number(r.value);
      });
      return map;
    },
  });

  useEffect(() => {
    if (config) {
      setLocal({ ...config });
    } else if (loja?.id && !isLoading) {
      setLocal({
        loja_id: loja.id,
        ativo: false,
        idioma: "en",
        enviar_email: true,
        enviar_sms: true,
        pais_origem: "CN",
        pais_origem_nome: "China",
        confirmacao_email: true,
        confirmacao_sms: false,
      });
    }
  }, [config, loja?.id, isLoading]);

  const custoEmailFluxo = custos?.custo_global_flow_email ?? 1.20;
  const custoSmsUnit = custos?.custo_global_flow_sms ?? 0.20;
  const custoConfEmail = custos?.custo_global_flow_confirmacao_email ?? 1.00;
  const custoEmailUnit = custoEmailFluxo / 10;

  const custoTotal = useMemo(() => {
    if (!local) return 0;
    let t = 0;
    if (local.enviar_email) t += custoEmailFluxo;
    if (local.enviar_sms) t += custoSmsUnit * 10;
    if (local.confirmacao_email) t += custoConfEmail;
    return t;
  }, [local, custoEmailFluxo, custoSmsUnit, custoConfEmail]);

  const eventosChanged = useMemo(() => {
    if (!eventos) return false;
    return eventos.some(
      (e) =>
        (localDelays[e.id] !== undefined && localDelays[e.id] !== e.delay_horas)
    );
  }, [eventos, localDelays]);


  const hasChanges = useMemo(() => {
    if (!local) return false;
    const cfgChanged = !config
      ? true
      : (Object.keys(local) as (keyof GlobalConfig)[]).some(
          (k) => local[k] !== (config as any)[k]
        );
    return cfgChanged || eventosChanged;
  }, [local, config, eventosChanged]);

  const save = useMutation({
    mutationFn: async () => {
      if (!local || !loja?.id) return;
      const { error } = await supabase
        .from("global_flow_config")
        .upsert(local, { onConflict: "loja_id" });
      if (error) throw error;

      // Save eventos (delays only)
      if (eventos) {
        for (const e of eventos) {
          const newDelay = localDelays[e.id];
          const changed = newDelay !== undefined && newDelay !== e.delay_horas;
          if (changed) {
            const { error: upErr } = await supabase
              .from("global_flow_eventos" as any)
              .update({ delay_horas: newDelay })
              .eq("id", e.id);
            if (upErr) throw upErr;
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["global-flow-config"] });
      queryClient.invalidateQueries({ queryKey: ["global-flow-eventos"] });
      toast({ title: "Configurações salvas com sucesso!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar", description: err?.message, variant: "destructive" });
    },
  });


  const toggleAtivo = async (v: boolean) => {
    if (!local) return;
    setLocal({ ...local, ativo: v });
    // persiste imediato para o toggle principal
    if (loja?.id) {
      await supabase.from("global_flow_config").upsert({ ...local, ativo: v }, { onConflict: "loja_id" });
      queryClient.invalidateQueries({ queryKey: ["global-flow-config"] });
      queryClient.invalidateQueries({ queryKey: ["global-flow-eventos"] });
      toast({ title: v ? "Fluxo Global ATIVADO" : "Fluxo Global desativado" });
    }
  };

  if (isLoading || !local) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  }

  

  const channels = [
    {
      key: "enviar_email",
      icon: Mail,
      title: "Email de Rastreio",
      desc: "Envia 1 email a cada uma das 10 etapas do fluxo internacional. Cobrança proporcional por etapa enviada.",
      unit: custoEmailFluxo,
      unitSuffix: " por todo o fluxo",
      unitDetail: `${custoEmailUnit.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/email`,
      total: custoEmailFluxo,
      checked: local.enviar_email,
      toggle: () => setLocal({ ...local, enviar_email: !local.enviar_email }),
    },
    {
      key: "enviar_sms",
      icon: MessageSquare,
      title: "SMS de Rastreio",
      desc: "Envia 1 SMS a cada uma das 10 etapas do fluxo internacional.",
      unit: custoSmsUnit,
      unitSuffix: "/SMS",
      total: custoSmsUnit * 10,
      checked: local.enviar_sms,
      toggle: () => setLocal({ ...local, enviar_sms: !local.enviar_sms }),
    },
    {
      key: "confirmacao_email",
      icon: BadgeCheck,
      title: "Email de Confirmação de Pagamento",
      desc: "Dispara assim que o pagamento internacional é aprovado. Traduzido automaticamente.",
      unit: custoConfEmail,
      unitSuffix: "/email",
      total: custoConfEmail,
      checked: local.confirmacao_email,
      toggle: () => setLocal({ ...local, confirmacao_email: !local.confirmacao_email }),
    },
  ];

  return (
    <div className="space-y-6 pb-28">
      {/* Hero */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-2xl glass glow-border">
            <Globe2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Fluxo Global</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Fluxo internacional padrão de 10 etapas em inglês ou espanhol, com confirmação de pagamento traduzida.
            </p>
          </div>
        </div>
        <Badge
          className={cn(
            "h-7 px-3 text-xs font-semibold uppercase tracking-wider",
            local.ativo
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
              : "bg-muted/40 text-muted-foreground border border-border/60"
          )}
        >
          {local.ativo ? "● Ativo" : "○ Desativado"}
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="glass glow-border p-1 h-auto">
          <TabsTrigger value="visao" className="flex items-center gap-1.5 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Visão Geral
          </TabsTrigger>
          <TabsTrigger value="origem" className="flex items-center gap-1.5 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Languages className="h-3.5 w-3.5" /> Origem & Idioma
          </TabsTrigger>
          <TabsTrigger value="canais" className="flex items-center gap-1.5 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Settings2 className="h-3.5 w-3.5" /> Canais & Custos
          </TabsTrigger>
        </TabsList>

        {/* ── Visão Geral ── */}
        <TabsContent value="visao" className="mt-6 space-y-6">
          {/* Status */}
          <Card className="p-6 glass glow-border">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "p-3 rounded-xl transition-colors",
                  local.ativo ? "bg-emerald-500/10" : "bg-muted/40"
                )}>
                  <ShieldCheck className={cn("h-6 w-6", local.ativo ? "text-emerald-400" : "text-muted-foreground")} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Status do Fluxo Global</h2>
                  <p className="text-sm text-muted-foreground">
                    {local.ativo
                      ? "Pedidos internacionais recebem notificações automáticas em 10 etapas."
                      : "Ative para começar a notificar seus clientes internacionais."}
                  </p>
                </div>
              </div>
              <Switch checked={local.ativo} onCheckedChange={toggleAtivo} className="scale-125" />
            </div>
          </Card>

          {/* Como funciona */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: Globe2, title: "Detecção automática", desc: "Pedidos sem CEP brasileiro entram no fluxo Global automaticamente." },
              { icon: Languages, title: "Idioma travado", desc: "O idioma é fixado no momento da criação do envio." },
              { icon: ShieldCheck, title: "Sem edição manual", desc: "Templates 100% padrão, traduzidos profissionalmente." },
            ].map((item) => (
              <Card key={item.title} className="p-5 glass">
                <item.icon className="h-5 w-5 text-primary mb-2" />
                <h3 className="font-semibold text-sm mb-1">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </Card>
            ))}
          </div>

          {/* Etapas editáveis do fluxo */}
          <Card className="p-6 glass glow-border">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-lg font-semibold">Etapas do fluxo Global</h2>
                <p className="text-sm text-muted-foreground">
                  Defina quantos dias cada etapa leva a partir da etapa anterior. Idioma atual:{" "}
                  <span className="text-primary font-medium">{local.idioma === "en" ? "English (US)" : "Español"}</span>
                </p>
              </div>
              <Badge variant="outline" className="text-xs">10 etapas</Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mb-4">
              A primeira etapa dispara imediatamente. As demais respeitam o intervalo configurado. Todas as etapas são obrigatórias.
            </p>

            <div className="space-y-2">
              {(eventos || []).map((evento, index) => {
                const isFirst = index === 0;
                const label =
                  local.idioma === "es" ? evento.nome_es : local.idioma === "en" ? evento.nome_en : evento.nome_pt;
                return (
                  <div
                    key={evento.id}
                    className="glass rounded-xl border border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.15)]"
                  >
                    <div className="flex items-center gap-3 py-3 px-4">
                      <GripVertical className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold bg-primary/10 text-primary">
                        {evento.step_order}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-foreground">{label}</span>
                          <span className="text-[10px] font-mono text-muted-foreground/60">{evento.step_key}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {evento.nome_pt}
                        </p>
                      </div>
                      {!isFirst ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <Clock className="h-3 w-3 text-muted-foreground/50" />
                          <DelayInput
                            value={localDelays[evento.id] ?? evento.delay_horas}
                            onChange={(delay_horas) =>
                              setLocalDelays((prev) => ({ ...prev, [evento.id]: delay_horas }))
                            }
                          />
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            dias após etapa anterior
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-emerald-400/80 shrink-0">Disparo imediato</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

        </TabsContent>

        {/* ── Origem & Idioma ── */}
        <TabsContent value="origem" className="mt-6 space-y-6">
          <Card className="p-6 glass glow-border">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Globe2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">País de origem do pedido</h2>
                <p className="text-sm text-muted-foreground">
                  Esse país aparece como remetente nos emails e na página de rastreio do cliente.
                </p>
              </div>
            </div>
            <CountryPicker
              value={local.pais_origem}
              lang={local.idioma}
              onChange={(c) => setLocal({ ...local, pais_origem: c.code, pais_origem_nome: c[local.idioma === "es" ? "name_es" : "name_en"] })}
            />
          </Card>

          <Card className="p-6 glass glow-border">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Languages className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Idioma das mensagens</h2>
                <p className="text-sm text-muted-foreground">
                  Aplica-se a todos os emails e SMS — incluindo a confirmação de pagamento.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {([
                { code: "en" as Lang, iso: "us", emoji: "🇺🇸", title: "English", sub: "United States" },
                { code: "es" as Lang, iso: "es", emoji: "🇪🇸", title: "Español", sub: "España / LatAm" },
              ]).map((opt) => {
                const active = local.idioma === opt.code;
                return (
                  <button
                    key={opt.code}
                    onClick={() => setLocal({ ...local, idioma: opt.code })}
                    className={cn(
                      "relative p-5 rounded-xl border-2 transition-all text-left",
                      active
                        ? "border-primary bg-primary/5 glow-border"
                        : "border-border/40 hover:border-primary/40 hover:bg-card/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={`https://flagcdn.com/w80/${opt.iso}.png`}
                        srcSet={`https://flagcdn.com/w160/${opt.iso}.png 2x`}
                        alt={opt.title}
                        width={48}
                        height={32}
                        className="rounded-md shadow-sm ring-1 ring-border/40 object-cover"
                        onError={(e) => {
                          // Fallback to emoji if flagcdn blocked
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                          const sib = e.currentTarget.nextElementSibling as HTMLElement | null;
                          if (sib) sib.style.display = "inline";
                        }}
                      />
                      <span className="text-3xl leading-none hidden">{opt.emoji}</span>
                      <div>
                        <p className={cn("font-semibold", active && "text-primary")}>{opt.title}</p>
                        <p className="text-xs text-muted-foreground">{opt.sub}</p>
                      </div>
                    </div>
                    {active && (
                      <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href="https://us.tracker-master.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                🇺🇸 Global Logistics (US) — us.tracker-master.com
              </a>
              <a
                href="https://estracker-master.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                🇪🇸 Logística Global (ES) — estracker-master.com
              </a>
            </div>

          </Card>
        </TabsContent>

        {/* ── Canais & Custos ── */}
        <TabsContent value="canais" className="mt-6 space-y-3">
          {channels.map((ch) => (
            <Card
              key={ch.key}
              className={cn(
                "p-5 glass transition-all",
                ch.checked ? "glow-border" : "border-border/40 opacity-80"
              )}
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "p-3 rounded-xl shrink-0 transition-colors",
                  ch.checked ? "bg-primary/15" : "bg-muted/40"
                )}>
                  <ch.icon className={cn("h-5 w-5", ch.checked ? "text-primary" : "text-muted-foreground")} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-semibold">{ch.title}</h3>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {formatMoedas(ch.unit)}{ch.unitSuffix}
                    </Badge>
                    {ch.unitDetail && (
                      <Badge variant="secondary" className="text-[10px] font-mono">
                        {ch.unitDetail}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{ch.desc}</p>
                </div>
                <div className="text-right shrink-0 hidden sm:block">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Total</p>
                  <p className="text-sm font-bold text-primary tabular-nums">{formatMoedas(ch.total)}</p>
                </div>
                <Switch checked={ch.checked} onCheckedChange={ch.toggle} />
              </div>
            </Card>
          ))}

          <Card className="p-4 mt-4 bg-muted/20 border-dashed">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Cobrança:</strong> O custo só é debitado quando cada mensagem é efetivamente enviada. Não há cobrança antecipada por pedido — o valor abaixo é apenas o teto estimado por pedido.
            </p>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Barra fixa inferior */}
      <div className="fixed bottom-0 left-0 right-0 md:left-[var(--sidebar-width,16rem)] z-30 border-t border-primary/10 bg-background/95 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4 px-6 py-3 max-w-[1400px] mx-auto">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Coins className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Custo estimado por pedido</p>
              <p className="text-lg font-bold text-primary tabular-nums">{formatMoedas(custoTotal)}</p>
            </div>
          </div>
          <Button
            onClick={() => save.mutate()}
            disabled={!hasChanges || save.isPending}
            className="gap-2"
            size="lg"
          >
            <Save className="h-4 w-4" />
            {save.isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </div>
    </div>
  );
}
