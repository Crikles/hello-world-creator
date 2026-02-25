import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Clock, Truck, CheckCircle, Mail, MessageSquare, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useLoja } from "@/contexts/LojaContext";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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

  const { data: envios = [] } = useQuery({
    queryKey: ["envios", loja?.id],
    queryFn: async () => {
      if (!loja) return [];
      const { data, error } = await supabase
        .from("envios")
        .select("*")
        .eq("loja_id", loja.id)
        .order("created_at", { ascending: false });
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

  const smsAtivo = postagemConfig?.ativar_site_rastreio ?? false;
  const emailAtivo = postagemConfig?.enviar_emails ?? false;

  const total = envios.length;
  const pendentes = envios.filter((e) => e.status === "pendente").length;
  const emTransito = envios.filter((e) => e.status === "em_transito" || e.status === "saiu_para_entrega").length;
  const entregues = envios.filter((e) => e.status === "entregue").length;
  const faturamento = envios.reduce((acc, e) => acc + Number(e.valor || 0), 0);

  const chartDataMap = new Map<string, { receita: number; pedidos: number }>();
  envios.forEach((e) => {
    const day = format(new Date(e.created_at), "dd/MM");
    const existing = chartDataMap.get(day) || { receita: 0, pedidos: 0 };
    existing.receita += Number(e.valor || 0);
    existing.pedidos += 1;
    chartDataMap.set(day, existing);
  });
  const chartData = Array.from(chartDataMap.entries())
    .map(([name, vals]) => ({ name, ...vals }))
    .reverse()
    .slice(-7);

  const recentUpdates = envios.slice(0, 6);

  const cards = [
    {
      title: "Total de Pedidos",
      value: total,
      icon: Package,
      gradient: "from-primary/90 to-primary/60",
    },
    {
      title: "Pendentes",
      value: pendentes,
      icon: Clock,
      gradient: "from-primary/70 to-accent",
    },
    {
      title: "Em Trânsito",
      value: emTransito,
      icon: Truck,
      gradient: "from-accent to-primary/50",
    },
    {
      title: "Entregues",
      value: entregues,
      icon: CheckCircle,
      gradient: "from-primary/80 to-primary/40",
    },
  ];

  return (
    <>
      <h1 className="text-lg font-semibold text-foreground mb-4">Dashboard</h1>
      <div className="space-y-6">
        {/* Welcome */}
        <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: "0ms" }}>
          <p className="text-muted-foreground text-sm">
            Bem-vindo de volta! Aqui está o resumo dos seus envios.
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card, i) => (
            <div
              key={card.title}
              className="opacity-0 animate-fade-in-up"
              style={{ animationDelay: `${(i + 1) * 100}ms` }}
            >
              <div
                className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${card.gradient} p-5 text-primary-foreground shadow-lg transition-transform hover:scale-[1.03] cursor-default border border-primary/20`}
              >
                <card.icon className="absolute -top-2 -right-2 h-20 w-20 opacity-15" />
                <p className="text-sm font-medium opacity-90">{card.title}</p>
                <p className="text-3xl font-bold mt-1">{card.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Chart + Notifications */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 opacity-0 animate-fade-in-up" style={{ animationDelay: "500ms" }}>
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Faturamento</CardTitle>
              <span className="ml-auto text-2xl font-bold text-foreground">
                R$ {faturamento.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </CardHeader>
            <CardContent>
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
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(45, 10%, 55%)" />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid hsl(0, 0%, 18%)",
                        backgroundColor: "hsl(0, 0%, 10%)",
                        color: "hsl(45, 30%, 92%)",
                        fontSize: "12px",
                      }}
                      formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Receita"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="receita"
                      stroke="hsl(43, 74%, 49%)"
                      strokeWidth={2}
                      fill="url(#colorReceita)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: "600ms" }}>
            <CardHeader>
              <CardTitle className="text-base">Canais de Notificação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={`flex items-center gap-3 p-3 rounded-lg ${emailAtivo ? "bg-accent border-primary/20" : "bg-muted/50 border-border"} border`}>
                <Mail className={`h-5 w-5 ${emailAtivo ? "text-primary" : "text-muted-foreground"}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Email</p>
                  <p className="text-xs text-muted-foreground">{emailAtivo ? "Notificações ativas" : "Não configurado"}</p>
                </div>
                <Badge className={emailAtivo ? "bg-primary/20 text-primary border-primary/30 hover:bg-primary/25" : ""} variant={emailAtivo ? "default" : "secondary"}>{emailAtivo ? "Ativo" : "Inativo"}</Badge>
              </div>
              <div className={`flex items-center gap-3 p-3 rounded-lg ${smsAtivo ? "bg-accent border-primary/20" : "bg-muted/50 border-border"} border`}>
                <MessageSquare className={`h-5 w-5 ${smsAtivo ? "text-primary" : "text-muted-foreground"}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">SMS</p>
                  <p className="text-xs text-muted-foreground">{smsAtivo ? "Notificações ativas" : "Não configurado"}</p>
                </div>
                <Badge className={smsAtivo ? "bg-primary/20 text-primary border-primary/30 hover:bg-primary/25" : ""} variant={smsAtivo ? "default" : "secondary"}>{smsAtivo ? "Ativo" : "Inativo"}</Badge>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                <Package className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Webhook</p>
                  <p className="text-xs text-muted-foreground">Não configurado</p>
                </div>
                <Badge variant="secondary">Inativo</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent updates timeline */}
        <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: "700ms" }}>
          <CardHeader>
            <CardTitle className="text-base">Últimas Atualizações</CardTitle>
          </CardHeader>
          <CardContent>
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
                      <div className="w-px h-full bg-border min-h-[24px]" />
                    </div>
                    <div className="flex-1 -mt-0.5">
                      <p className="text-sm font-medium text-foreground">
                        {envio.cliente_nome} — <span className="font-normal text-muted-foreground">{envio.produto}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {statusLabels[envio.status]} • {format(new Date(envio.created_at), "dd/MM/yyyy HH:mm")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
