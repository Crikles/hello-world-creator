import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Plus, Search, Truck, Trash2, Play, FastForward, Package, Clock, Navigation, CheckCircle2, Calendar } from "lucide-react";
import { ImportarPlanilha } from "@/components/envios/ImportarPlanilha";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { NovoEnvioWizard } from "@/components/envios/NovoEnvioWizard";
import { triggerNextEmail, InsufficientBalanceError } from "@/lib/email-trigger";

function formatProduto(raw: string): string {
  try {
    const items = JSON.parse(raw);
    if (Array.isArray(items)) {
      return items.map((i: any) => `${i.nome} (x${i.quantidade})`).join(", ");
    }
  } catch {
    // not JSON, return as-is
  }
  return raw;
}

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  coletado: "Coletado",
  em_transito: "Em Trânsito",
  centro_local: "Centro Local",
  saiu_para_entrega: "Saiu p/ Entrega",
  entregue: "Entregue",
  taxacao: "Taxação",
  pagamento_confirmado: "Pgto. Confirmado",
};

const statusColors: Record<string, string> = {
  pendente: "bg-primary/20 text-primary",
  coletado: "bg-accent text-accent-foreground",
  em_transito: "bg-accent text-accent-foreground",
  centro_local: "bg-primary/25 text-primary",
  saiu_para_entrega: "bg-primary/30 text-primary",
  entregue: "bg-primary/15 text-primary",
  taxacao: "bg-destructive/20 text-destructive",
  pagamento_confirmado: "bg-primary/20 text-primary",
};

const statusOptions = [
  { value: "pendente", label: "Pendente" },
  { value: "coletado", label: "Coletado" },
  { value: "em_transito", label: "Em Trânsito" },
  { value: "centro_local", label: "Centro Local" },
  { value: "saiu_para_entrega", label: "Saiu para Entrega" },
  { value: "entregue", label: "Entregue" },
  { value: "taxacao", label: "Taxação" },
  { value: "pagamento_confirmado", label: "Pgto. Confirmado" },
];

export default function Envios() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [autoEnvio, setAutoEnvio] = useState(false);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [batchCooldown, setBatchCooldown] = useState(0);
  const [, setTick] = useState(0);
  const queryClient = useQueryClient();
  const { loja } = useLoja();

  // Force re-render every second for countdown display
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatCooldown = (expiresAt: number) => {
    const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  };

  // Fetch total events count for progress calculation
  const { data: totalEventos = 0 } = useQuery({
    queryKey: ["total-eventos", loja?.id],
    queryFn: async () => {
      if (!loja) return 0;
      const { data: config } = await supabase
        .from("postagem_config")
        .select("template_ativo_id")
        .eq("loja_id", loja.id)
        .maybeSingle();
      if (!config?.template_ativo_id) return 0;
      const { count } = await supabase
        .from("postagem_eventos")
        .select("*", { count: "exact", head: true })
        .eq("template_id", config.template_ativo_id);
      return count ?? 0;
    },
    enabled: !!loja,
  });

  const { data: envios = [] } = useQuery({
    queryKey: ["envios", loja?.id],
    queryFn: async () => {
      if (!loja) return [];
      const { data, error } = await supabase
        .from("envios")
        .select("*")
        .eq("loja_id", loja.id)
        .is("deleted_at" as any, null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!loja,
  });

  // Realtime listener for envios updates
  useEffect(() => {
    if (!loja?.id) return;
    const channel = supabase
      .channel(`envios-realtime-${loja.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "envios", filter: `loja_id=eq.${loja.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["envios", loja.id] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loja?.id, queryClient]);

  const advanceMutation = useMutation({
    mutationFn: async (envioId: string) => {
      if (!loja?.id) throw new Error("No loja");
      const result = await triggerNextEmail(envioId, loja.id);
      if (!result) throw new Error("Nenhum evento para avançar");
      return result;
    },
    onSuccess: (_data, envioId) => {
      queryClient.invalidateQueries({ queryKey: ["envios"] });
      setCooldowns((prev) => ({ ...prev, [envioId]: Date.now() + 120000 }));
      toast.success("Avançado!");
    },
    onError: (err: any) => {
      if (err instanceof InsufficientBalanceError) {
        toast.error("Saldo insuficiente de moedas. Adicione créditos para continuar.");
      } else {
        toast.error(err.message || "Erro ao avançar");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("envios").update({ deleted_at: new Date().toISOString() } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["envios"] });
      toast.success("Envio removido.");
    },
  });

  const batchAdvance = async (filterFn: (e: any) => boolean) => {
    const targets = envios.filter(filterFn);
    if (targets.length === 0) return toast.info("Nenhum envio encontrado.");
    let count = 0;
    for (const envio of targets) {
      if (!loja?.id) continue;
      const result = await triggerNextEmail(envio.id, loja.id);
      if (result) count++;
    }
    queryClient.invalidateQueries({ queryKey: ["envios"] });
    setBatchCooldown(Date.now() + 120000);
    toast.success(`${count} envio(s) avançado(s)!`);
  };

  const filteredEnvios = envios.filter((e) => {
    const matchSearch =
      e.cliente_nome.toLowerCase().includes(search.toLowerCase()) ||
      e.produto.toLowerCase().includes(search.toLowerCase()) ||
      (e.codigo_rastreio && e.codigo_rastreio.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = filterStatus === "todos" || e.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const getProgress = (envio: any) => {
    if (totalEventos === 0) return 0;
    const ordem = envio.ultimo_evento_ordem ?? 0;
    return Math.round((ordem / totalEventos) * 100);
  };

  const getCurrentStep = (envio: any) => {
    return envio.ultimo_evento_ordem ?? 0;
  };

  const canAdvance = (envio: any) => {
    const ordem = envio.ultimo_evento_ordem ?? 0;
    return totalEventos > 0 && ordem < totalEventos;
  };

  const getDisplayStatus = (envio: any) => {
    return (envio as any).status_label || statusLabels[envio.status] || envio.status;
  };

  // Metrics
  const totalCount = envios.length;
  const pendentesCount = envios.filter((e) => e.status === "pendente").length;
  const transitoCount = envios.filter((e) => e.status === "em_transito" || e.status === "saiu_para_entrega" || e.status === "coletado" || e.status === "centro_local").length;
  const entreguesCount = envios.filter((e) => e.status === "entregue").length;

  const metrics = [
    { label: "Total", value: totalCount, icon: Package, delay: 0 },
    { label: "Pendentes", value: pendentesCount, icon: Clock, delay: 0.08 },
    { label: "Em Trânsito", value: transitoCount, icon: Navigation, delay: 0.16 },
    { label: "Entregues", value: entreguesCount, icon: CheckCircle2, delay: 0.24 },
  ];

  return (
    <>
      <div className="space-y-6">
        {/* Hero + Metrics */}
        <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Centro de Envios
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitore e gerencie todos os seus envios em tempo real.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {metrics.map((m) => (
              <div
                key={m.label}
                className="glass glow-border rounded-xl p-4 animate-stagger-in"
                style={{ animationDelay: `${m.delay}s` }}
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <m.icon className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground leading-none">{m.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{m.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Bar */}
        <div className="glass-strong glow-border rounded-xl p-3">
          <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 glass rounded-lg px-3 py-1.5">
                <Switch checked={autoEnvio} onCheckedChange={setAutoEnvio} />
                <span className="text-xs text-muted-foreground whitespace-nowrap">Auto</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs hover:bg-primary/10 hover:text-primary"
                disabled={batchCooldown > Date.now()}
                onClick={() => batchAdvance((e) => e.status === "pendente")}
              >
                <Play className="h-3.5 w-3.5 mr-1 text-primary" />
                {batchCooldown > Date.now() ? formatCooldown(batchCooldown) : "Iniciar Pendentes"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs hover:bg-primary/10 hover:text-primary"
                disabled={batchCooldown > Date.now()}
                onClick={() => batchAdvance((e) => e.status !== "entregue")}
              >
                <FastForward className="h-3.5 w-3.5 mr-1 text-primary" />
                {batchCooldown > Date.now() ? formatCooldown(batchCooldown) : "Avançar Todos"}
              </Button>
            </div>

            <div className="flex gap-2 items-center w-full lg:w-auto">
              <div className="relative flex-1 lg:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs bg-transparent border-border/50"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[120px] h-8 text-xs bg-transparent border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {statusOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {loja && <ImportarPlanilha lojaId={loja.id} />}
              <Button
                size="sm"
                className="shimmer-btn h-8 text-xs"
                onClick={() => setWizardOpen(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Novo Envio
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        {filteredEnvios.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="relative mb-6">
              <div className="h-20 w-20 rounded-full bg-primary/5 flex items-center justify-center">
                <Truck className="h-10 w-10 text-primary/30" />
              </div>
              <div className="absolute inset-0 animate-orbit">
                <div className="h-2.5 w-2.5 rounded-full bg-primary/40 animate-pulse-dot" />
              </div>
              <div className="absolute inset-0 animate-orbit" style={{ animationDelay: "-2.5s" }}>
                <div className="h-1.5 w-1.5 rounded-full bg-primary/25 animate-pulse-dot" style={{ animationDelay: "1s" }} />
              </div>
            </div>
            <p className="text-foreground font-medium text-lg">Nenhum envio por aqui... ainda</p>
            <p className="text-muted-foreground text-sm mt-1 max-w-xs">
              Crie seu primeiro envio e acompanhe todo o fluxo de entrega em tempo real.
            </p>
            <Button className="shimmer-btn mt-5" onClick={() => setWizardOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Criar Primeiro Envio
            </Button>
          </div>
        ) : (
          /* Envio Cards Grid */
          <div className="flex flex-col gap-3">
            {filteredEnvios.map((envio, idx) => (
              <div
                key={envio.id}
                className="glass glow-border-hover rounded-xl p-4 transition-all duration-300 hover:scale-[1.02] animate-stagger-in group"
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                {/* Card Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground truncate">{envio.cliente_nome}</p>
                    <p className="text-xs text-muted-foreground truncate">{envio.cliente_email}</p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`${statusColors[envio.status] || "bg-muted text-muted-foreground"} text-[10px] ml-2 whitespace-nowrap`}
                  >
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-current mr-1 animate-pulse-dot" />
                    {getDisplayStatus(envio)}
                  </Badge>
                </div>

                {/* Card Body */}
                <div className="space-y-2.5">
                  <p className="text-xs text-muted-foreground line-clamp-1">{formatProduto(envio.produto)}</p>

                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-primary">R$ {Number(envio.valor).toFixed(2)}</span>
                    {envio.codigo_rastreio && (
                      <span className="font-mono text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                        {envio.codigo_rastreio}
                      </span>
                    )}
                  </div>

                  {/* Progress */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Etapa {getCurrentStep(envio)}/{totalEventos}</span>
                      <span>{getProgress(envio)}%</span>
                    </div>
                    <Progress value={getProgress(envio)} className="h-1.5" />
                  </div>
                </div>

                {/* Card Footer */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(envio.created_at), "dd/MM/yyyy")}
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {canAdvance(envio) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
                        title={cooldowns[envio.id] > Date.now() ? `Aguarde ${formatCooldown(cooldowns[envio.id])}` : "Avançar próximo evento"}
                        disabled={advanceMutation.isPending || cooldowns[envio.id] > Date.now()}
                        onClick={() => advanceMutation.mutate(envio.id)}
                      >
                        {cooldowns[envio.id] > Date.now() ? (
                          <span className="text-[9px] font-mono">{formatCooldown(cooldowns[envio.id])}</span>
                        ) : (
                          <FastForward className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Remover"
                      onClick={() => deleteMutation.mutate(envio.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <NovoEnvioWizard open={wizardOpen} onOpenChange={setWizardOpen} />
      </div>
    </>
  );
}
