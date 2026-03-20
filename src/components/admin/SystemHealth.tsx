import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Activity, Database, Clock, AlertTriangle, CheckCircle2,
  Mail, Webhook, Package, Server, BarChart3,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";

type HealthLevel = "green" | "yellow" | "red";

function getLevel(value: number, green: number, yellow: number): HealthLevel {
  if (value < green) return "green";
  if (value < yellow) return "yellow";
  return "red";
}

const levelColors: Record<HealthLevel, string> = {
  green: "text-emerald-400",
  yellow: "text-amber-400",
  red: "text-red-400",
};

const levelBg: Record<HealthLevel, string> = {
  green: "bg-emerald-500/15 border-emerald-500/30",
  yellow: "bg-amber-500/15 border-amber-500/30",
  red: "bg-red-500/15 border-red-500/30",
};

const levelBadge: Record<HealthLevel, string> = {
  green: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  yellow: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  red: "bg-red-500/20 text-red-400 border-red-500/30",
};

const levelLabel: Record<HealthLevel, string> = {
  green: "Saudável",
  yellow: "Atenção",
  red: "Crítico",
};

export function SystemHealth() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-system-health"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();
      const yesterday = new Date(Date.now() - 86400000).toISOString();

      const [
        filaAvanco,
        emailsPendentes,
        webhooksTotal,
        webhooksFailed,
        // Table counts
        enviosCount,
        pedidosCount,
        emailLogCount,
        webhookLogCount,
        leadsCount,
        profilesCount,
        lojasCount,
        empresasCount,
        creditosCount,
        whatsappLogCount,
      ] = await Promise.all([
        // Queue: shipments waiting to advance
        supabase
          .from("envios")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null)
          .lte("proximo_avanco_em", now)
          .not("status_label", "in", '("Falha Entrega","Taxação","Taxacao")'),
        // Pending emails today
        supabase
          .from("postagem_email_log")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .gte("created_at", todayISO),
        // Webhooks last 24h total
        supabase
          .from("webhook_logs")
          .select("id", { count: "exact", head: true })
          .gte("created_at", yesterday),
        // Webhooks last 24h failed
        supabase
          .from("webhook_logs")
          .select("id", { count: "exact", head: true })
          .gte("created_at", yesterday)
          .eq("status", "error"),
        // Table counts
        supabase.from("envios").select("id", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("pedidos").select("id", { count: "exact", head: true }),
        supabase.from("postagem_email_log").select("id", { count: "exact", head: true }),
        supabase.from("webhook_logs").select("id", { count: "exact", head: true }),
        supabase.from("leads").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("lojas").select("id", { count: "exact", head: true }),
        supabase.from("empresas").select("id", { count: "exact", head: true }),
        supabase.from("creditos").select("id", { count: "exact", head: true }),
        supabase.from("whatsapp_message_log").select("id", { count: "exact", head: true }),
      ]);

      const wTotal = webhooksTotal.count || 0;
      const wFailed = webhooksFailed.count || 0;
      const webhookErrorRate = wTotal > 0 ? (wFailed / wTotal) * 100 : 0;

      const tables = [
        { name: "envios", rows: enviosCount.count || 0 },
        { name: "pedidos", rows: pedidosCount.count || 0 },
        { name: "postagem_email_log", rows: emailLogCount.count || 0 },
        { name: "webhook_logs", rows: webhookLogCount.count || 0 },
        { name: "leads", rows: leadsCount.count || 0 },
        { name: "profiles", rows: profilesCount.count || 0 },
        { name: "lojas", rows: lojasCount.count || 0 },
        { name: "empresas", rows: empresasCount.count || 0 },
        { name: "creditos", rows: creditosCount.count || 0 },
        { name: "whatsapp_message_log", rows: whatsappLogCount.count || 0 },
      ].sort((a, b) => b.rows - a.rows);

      const totalRows = tables.reduce((s, t) => s + t.rows, 0);

      return {
        filaAvanco: filaAvanco.count || 0,
        emailsPendentes: emailsPendentes.count || 0,
        webhooksTotal: wTotal,
        webhooksFailed: wFailed,
        webhookErrorRate,
        tables,
        totalRows,
      };
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const filaLevel = getLevel(data.filaAvanco, 50, 200);
  const emailLevel = getLevel(data.emailsPendentes, 20, 100);
  const webhookLevel = getLevel(data.webhookErrorRate, 5, 15);

  // Overall system status
  const levels: HealthLevel[] = [filaLevel, emailLevel, webhookLevel];
  const overallLevel: HealthLevel = levels.includes("red")
    ? "red"
    : levels.includes("yellow")
    ? "yellow"
    : "green";

  const maxRows = data.tables[0]?.rows || 1;

  const queueCards = [
    {
      title: "Fila de Avanço",
      value: data.filaAvanco,
      icon: Package,
      level: filaLevel,
      desc: "Envios aguardando processamento",
    },
    {
      title: "Emails Pendentes",
      value: data.emailsPendentes,
      icon: Mail,
      level: emailLevel,
      desc: "Emails pendentes hoje",
    },
    {
      title: "Webhooks 24h",
      value: data.webhooksTotal,
      icon: Webhook,
      level: webhookLevel,
      desc: `${data.webhooksFailed} falhas (${data.webhookErrorRate.toFixed(1)}%)`,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl border ${levelBg[overallLevel]}`}>
            <Activity className={`h-5 w-5 ${levelColors[overallLevel]}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">Saúde do Sistema</h2>
              <Badge className={`text-[10px] px-2 py-0 ${levelBadge[overallLevel]}`}>
                {levelLabel[overallLevel]}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Atualiza a cada 30s • {data.totalRows.toLocaleString("pt-BR")} registros totais</p>
          </div>
        </div>
      </div>

      {/* Queue Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {queueCards.map((card) => (
          <Card key={card.title} className={`border transition-colors ${levelBg[card.level]}`}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {card.title}
                </span>
                <card.icon className={`h-4 w-4 ${levelColors[card.level]}`} />
              </div>
              <p className="text-3xl font-bold text-foreground tabular-nums">
                {card.value.toLocaleString("pt-BR")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{card.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table Sizes */}
      <Card className="border-border/50">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-2 mb-4">
            <Database className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Tabelas do Banco</span>
            <span className="text-xs text-muted-foreground ml-auto">
              {data.totalRows.toLocaleString("pt-BR")} registros
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs">Tabela</TableHead>
                <TableHead className="text-xs text-right w-24">Registros</TableHead>
                <TableHead className="text-xs w-48">Proporção</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.tables.map((t) => (
                <TableRow key={t.name} className="hover:bg-muted/30">
                  <TableCell className="font-mono text-xs py-2">{t.name}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs py-2">
                    {t.rows.toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex items-center gap-2">
                      <Progress
                        value={(t.rows / maxRows) * 100}
                        className="h-1.5 flex-1"
                      />
                      <span className="text-[10px] text-muted-foreground tabular-nums w-10 text-right">
                        {data.totalRows > 0 ? ((t.rows / data.totalRows) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
