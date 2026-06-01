import { useState, useEffect } from "react";
import { formatProduto } from "@/lib/format-produto";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Clock, Truck, CheckCircle, Mail, MessageSquare, TrendingUp, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useLoja } from "@/contexts/LojaContext";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { BloqueioCobrancaBanner } from "@/components/BloqueioCobrancaBanner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  em_transito: "Em Trânsito",
  saiu_para_entrega: "Saiu p/ Entrega",
  entregue: "Entregue",
};

const statusTimelineColors: Record<string, string> = {
  pendente: "bg-primary/60",
  em_transito: "bg-primary",
  saiu_para_entrega: "bg-primary/80",
  entregue: "bg-accent-foreground",
};

export default function Dashboard() {
  const { loja } = useLoja();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    document.title = "Magnus Frete - Dashboard";
  }, []);

  // Server-side counts for cards (no 1000 limit)
  const { data: counts } = useQuery({
    queryKey: ["envios-counts", loja?.id],
    queryFn: async () => {
      if (!loja) return { total: 0, pendentes: 0, emTransito: 0, entregues: 0 };
      const [totalQ, pendentesQ, emTransitoQ, saiuQ, entreguesQ] = await Promise.all([
        supabase.from("envios").select("id", { count: "exact", head: true }).eq("loja_id", loja.id).is("deleted_at", null),
        supabase.from("envios").select("id", { count: "exact", head: true }).eq("loja_id", loja.id).is("deleted_at", null).eq("status", "pendente"),
        supabase.from("envios").select("id", { count: "exact", head: true }).eq("loja_id", loja.id).is("deleted_at", null).eq("status", "em_transito"),
        supabase.from("envios").select("id", { count: "exact", head: true }).eq("loja_id", loja.id).is("deleted_at", null).eq("status", "saiu_para_entrega"),
        supabase.from("envios").select("id", { count: "exact", head: true }).eq("loja_id", loja.id).is("deleted_at", null).eq("status", "entregue"),
      ]);
      return {
        total: totalQ.count || 0,
        pendentes: pendentesQ.count || 0,
        emTransito: (emTransitoQ.count || 0) + (saiuQ.count || 0),
        entregues: entreguesQ.count || 0,
      };
    },
    enabled: !!loja,
  });

  // Faturamento: server-side aggregation
  const { data: faturamento = 0 } = useQuery({
    queryKey: ["envios-faturamento", loja?.id],
    queryFn: async () => {
      if (!loja) return 0;
      const { data, error } = await supabase.rpc("get_loja_faturamento", { p_loja_id: loja.id });
      if (error) throw error;
      return Number(data) || 0;
    },
    enabled: !!loja,
  });

  // Chart data: server-side aggregation
  const { data: chartData = [] } = useQuery({
    queryKey: ["envios-chart", loja?.id],
    queryFn: async () => {
      if (!loja) return [];
      const { data, error } = await supabase.rpc("get_loja_chart_data", { p_loja_id: loja.id });
      if (error) throw error;
      return (data || []).map((row: { dia: string; receita: number; pedidos: number }) => ({
        name: format(new Date(row.dia + "T00:00:00"), "dd/MM/yy"),
        receita: Number(row.receita),
        pedidos: Number(row.pedidos),
      }));
    },
    enabled: !!loja,
  });

  // Recent updates: only 6
  const { data: recentUpdates = [] } = useQuery({
    queryKey: ["envios-recent", loja?.id],
    queryFn: async () => {
      if (!loja) return [];
      const { data, error } = await supabase
        .from("envios")
        .select("*")
        .eq("loja_id", loja.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
    enabled: !!loja,
  });

  const { data: postagemConfig } = useQuery({
    queryKey: ["postagem_config_dashboard", loja?.id],
    queryFn: async () => {
      if (!loja) return null;
      const { data, error } = await supabase
        .from("postagem_config")
        .select("ativar_site_rastreio, enviar_emails")
        .eq("loja_id", loja.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!loja,
  });

  const { data: shopifyConfig } = useQuery({
    queryKey: ["shopify-integration-dashboard", loja?.id],
    queryFn: async () => {
      if (!loja) return null;
      const { data, error } = await supabase
        .from("shopify_integrations")
        .select("id, access_token, ativo")
        .eq("loja_id", loja.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!loja,
  });

  const { data: checkoutIntegrations = [] } = useQuery({
    queryKey: ["checkout-integrations-dashboard", loja?.id],
    queryFn: async () => {
      if (!loja) return [];
      const { data, error } = await supabase
        .from("checkout_integrations")
        .select("checkout_id, ativo")
        .eq("loja_id", loja.id)
        .eq("ativo", true);
      if (error) throw error;
      return data as { checkout_id: string; ativo: boolean }[];
    },
    enabled: !!loja,
  });

  const clearLogsMutation = useMutation({
    mutationFn: async () => {
      if (!loja) throw new Error("Sem loja");
      const { error } = await supabase
        .from("envios")
        .update({ deleted_at: new Date().toISOString() })
        .eq("loja_id", loja.id)
        .is("deleted_at", null);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["envios-counts", loja?.id] });
      queryClient.invalidateQueries({ queryKey: ["envios-faturamento", loja?.id] });
      queryClient.invalidateQueries({ queryKey: ["envios-chart", loja?.id] });
      queryClient.invalidateQueries({ queryKey: ["envios-recent", loja?.id] });
      queryClient.invalidateQueries({ queryKey: ["envios", loja?.id] });
      toast.success("Todos os registros de envios foram limpos.");
      setConfirmOpen(false);
    },
    onError: () => toast.error("Erro ao limpar registros."),
  });

  const smsAtivo = postagemConfig?.ativar_site_rastreio ?? false;
  const emailAtivo = postagemConfig?.enviar_emails ?? false;
  const webhookAtivo = (!!shopifyConfig && (shopifyConfig as any).ativo === true && !!(shopifyConfig as any).access_token) || checkoutIntegrations.length > 0;

  const total = counts?.total ?? 0;
  const pendentes = counts?.pendentes ?? 0;
  const emTransito = counts?.emTransito ?? 0;
  const entregues = counts?.entregues ?? 0;


  const cards = [
    { title: "Total de Pedidos", value: total, icon: Package },
    { title: "Pendentes", value: pendentes, icon: Clock },
    { title: "Em Trânsito", value: emTransito, icon: Truck },
    { title: "Entregues", value: entregues, icon: CheckCircle },
  ];

  return (
    <div className="space-y-6">
      <BloqueioCobrancaBanner />
      {/* Header */}
      <div className="animate-stagger-in flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Bem-vindo de volta! Aqui está o resumo dos seus envios.
          </p>
        </div>
        {total > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Limpar Logs
          </Button>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar todos os registros de envios?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá remover todos os envios da sua loja. Os dados não serão excluídos permanentemente, mas não aparecerão mais nas listagens.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => clearLogsMutation.mutate()}
              disabled={clearLogsMutation.isPending}
            >
              {clearLogsMutation.isPending ? "Limpando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <div
            key={card.title}
            className="animate-stagger-in"
            style={{ animationDelay: `${(i + 1) * 80}ms` }}
          >
            <div className="relative overflow-hidden rounded-2xl glass glow-border glow-border-hover p-5 transition-all duration-300 hover:scale-[1.02] cursor-default group">
              <div className="absolute -top-3 -right-3 h-20 w-20 rounded-full bg-primary/5 group-hover:bg-primary/10 transition-colors" />
              <card.icon className="absolute top-4 right-4 h-8 w-8 text-primary/20 group-hover:text-primary/30 transition-colors" />
              <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
              <p className="text-3xl font-bold text-foreground mt-1">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Chart + Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div
          className="lg:col-span-2 rounded-2xl glass glow-border p-6 animate-stagger-in"
          style={{ animationDelay: "400ms" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Faturamento</h2>
            <span className="ml-auto text-2xl font-bold text-foreground">
              R$ {faturamento.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </div>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              Nenhum dado para exibir ainda.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(43, 74%, 49%)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(43, 74%, 49%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 18%)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(45, 10%, 55%)" />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} stroke="hsl(45, 10%, 55%)" />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} stroke="hsl(200, 70%, 55%)" />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid hsla(43, 74%, 49%, 0.15)",
                    backgroundColor: "hsla(0, 0%, 7%, 0.9)",
                    backdropFilter: "blur(12px)",
                    color: "hsl(45, 30%, 92%)",
                    fontSize: "12px",
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === "pedidos") return [value, "Pedidos"];
                    return [`R$ ${value.toFixed(2)}`, "Receita"];
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="pedidos"
                  stroke="hsl(200, 70%, 55%)"
                  strokeWidth={2}
                  fill="none"
                  strokeDasharray="5 5"
                  yAxisId="right"
                />
                <Area
                  type="monotone"
                  dataKey="receita"
                  stroke="hsl(43, 74%, 49%)"
                  strokeWidth={2}
                  fill="url(#colorReceita)"
                  yAxisId="left"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div
          className="rounded-2xl glass glow-border p-6 animate-stagger-in"
          style={{ animationDelay: "500ms" }}
        >
          <h2 className="text-base font-semibold text-foreground mb-4">Canais de Notificação</h2>
          <div className="space-y-3">
            {[
              { icon: Mail, label: "Email", sub: emailAtivo ? "Notificações ativas" : "Não configurado", active: emailAtivo },
              { icon: MessageSquare, label: "SMS", sub: smsAtivo ? "Notificações ativas" : "Não configurado", active: smsAtivo },
              { icon: Package, label: "Webhook", sub: webhookAtivo ? "Integração ativa" : "Não configurado", active: webhookAtivo },
            ].map((ch) => (
              <div
                key={ch.label}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                  ch.active
                    ? "glass glow-border"
                    : "bg-muted/20 border border-border/50"
                }`}
              >
                <ch.icon className={`h-5 w-5 ${ch.active ? "text-primary" : "text-muted-foreground"}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{ch.label}</p>
                  <p className="text-xs text-muted-foreground">{ch.sub}</p>
                </div>
                <Badge
                  className={
                    ch.active
                      ? "bg-primary/15 text-primary border-primary/25 hover:bg-primary/20"
                      : "bg-muted/30 text-muted-foreground border-border/50"
                  }
                  variant={ch.active ? "default" : "secondary"}
                >
                  {ch.active ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent updates */}
      <div
        className="rounded-2xl glass glow-border p-6 animate-stagger-in"
        style={{ animationDelay: "600ms" }}
      >
        <h2 className="text-base font-semibold text-foreground mb-4">Últimas Atualizações</h2>
        {recentUpdates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum envio cadastrado ainda.
          </p>
        ) : (
          <div className="space-y-4">
            {recentUpdates.map((envio) => (
              <div key={envio.id} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className={`h-3 w-3 rounded-full ${statusTimelineColors[envio.status]} ring-4 ring-background`} />
                  <div className="w-px h-full bg-border/30 min-h-[24px]" />
                </div>
                <div className="flex-1 -mt-0.5">
                  <p className="text-sm font-medium text-foreground">
                    {envio.cliente_nome} — <span className="font-normal text-muted-foreground">{formatProduto(envio.produto)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {statusLabels[envio.status]} • {format(new Date(envio.created_at), "dd/MM/yyyy HH:mm")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
