import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Activity, Database, Clock, AlertTriangle, CheckCircle2,
  Mail, Webhook, Package, Server, BarChart3, Users,
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

      {/* Per-User Usage */}
      <UserUsageTable />
    </div>
  );
}

async function fetchAllPaginated<T>(
  tableName: string,
  selectFields: string,
  orderBy?: string,
): Promise<T[]> {
  const PAGE = 1000;
  let all: T[] = [];
  let from = 0;
  while (true) {
    let q = supabase.from(tableName as any).select(selectFields).range(from, from + PAGE - 1);
    if (orderBy) q = q.order(orderBy, { ascending: false });
    const { data, error } = await q;
    if (error || !data || data.length === 0) break;
    all = all.concat(data as T[]);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

function UserUsageTable() {
  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-user-usage"],
    queryFn: async () => {
      // Fetch ALL profiles (paginated)
      const profiles = await fetchAllRows<{ id: string; full_name: string | null; email: string | null; created_at: string }>(
        () => supabase.from("profiles").select("id, full_name, email, created_at"),
        "id, full_name, email, created_at",
        "profiles",
      );

      if (profiles.length === 0) return [];

      // Fetch ALL lojas (paginated)
      const lojas = await fetchAllRows<{ id: string; user_id: string; nome: string }>(
        () => supabase.from("lojas").select("id, user_id, nome"),
        "id, user_id, nome",
        "lojas",
      );

      // Fetch ALL creditos (paginated)
      const creditos = await fetchAllRows<{ user_id: string; saldo: number }>(
        () => supabase.from("creditos").select("user_id, saldo"),
        "user_id, saldo",
        "creditos",
      );

      const lojasByUser = new Map<string, string[]>();
      lojas.forEach((l) => {
        const arr = lojasByUser.get(l.user_id) || [];
        arr.push(l.id);
        lojasByUser.set(l.user_id, arr);
      });

      const allLojaIds = lojas.map((l) => l.id);

      // Use exact counts per loja instead of fetching all rows
      // For each loja, get counts via head:true queries
      const enviosByLoja = new Map<string, number>();
      const emailsByLoja = new Map<string, number>();
      const leadsByLoja = new Map<string, number>();

      // Batch count queries for all lojas in parallel (chunks of 20)
      const CHUNK = 20;
      for (let i = 0; i < allLojaIds.length; i += CHUNK) {
        const chunk = allLojaIds.slice(i, i + CHUNK);
        const promises = chunk.flatMap((lojaId) => [
          supabase.from("envios").select("id", { count: "exact", head: true }).eq("loja_id", lojaId).is("deleted_at", null),
          supabase.from("postagem_email_log").select("id", { count: "exact", head: true }).eq("loja_id", lojaId),
          supabase.from("leads").select("id", { count: "exact", head: true }).eq("loja_id", lojaId),
        ]);
        const results = await Promise.all(promises);
        chunk.forEach((lojaId, idx) => {
          enviosByLoja.set(lojaId, results[idx * 3].count || 0);
          emailsByLoja.set(lojaId, results[idx * 3 + 1].count || 0);
          leadsByLoja.set(lojaId, results[idx * 3 + 2].count || 0);
        });
      }

      const creditosByUser = new Map<string, number>();
      creditos.forEach((c) => creditosByUser.set(c.user_id, c.saldo));

      const result = profiles.map((p) => {
        const userLojas = lojasByUser.get(p.id) || [];
        const envios = userLojas.reduce((s, lid) => s + (enviosByLoja.get(lid) || 0), 0);
        const emails = userLojas.reduce((s, lid) => s + (emailsByLoja.get(lid) || 0), 0);
        const leads = userLojas.reduce((s, lid) => s + (leadsByLoja.get(lid) || 0), 0);
        const saldo = creditosByUser.get(p.id) || 0;
        const total = envios + emails + leads;

        return {
          id: p.id,
          name: p.full_name || p.email || "Sem nome",
          email: p.email || "-",
          lojas: userLojas.length,
          envios,
          emails,
          leads,
          saldo,
          total,
        };
      });

      return result.sort((a, b) => b.total - a.total);
    },
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardContent className="pt-5 pb-4 flex justify-center">
          <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!users || users.length === 0) return null;

  const maxTotal = users[0]?.total || 1;

  return (
    <Card className="border-border/50">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Uso por Usuário</span>
          <span className="text-xs text-muted-foreground ml-auto">
            {users.length} usuários
          </span>
        </div>
        <div className="overflow-auto max-h-[400px]">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs">Usuário</TableHead>
                <TableHead className="text-xs text-right w-16">Lojas</TableHead>
                <TableHead className="text-xs text-right w-16">Envios</TableHead>
                <TableHead className="text-xs text-right w-16">Emails</TableHead>
                <TableHead className="text-xs text-right w-16">Leads</TableHead>
                <TableHead className="text-xs text-right w-20">Créditos</TableHead>
                <TableHead className="text-xs w-36">Uso Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} className="hover:bg-muted/30">
                  <TableCell className="py-2">
                    <div>
                      <p className="text-xs font-medium text-foreground truncate max-w-[180px]">{u.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">{u.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs py-2">{u.lojas}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs py-2">{u.envios.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs py-2">{u.emails.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs py-2">{u.leads.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs py-2">
                    <span className={u.saldo <= 0 ? "text-red-400" : "text-emerald-400"}>
                      {u.saldo.toLocaleString("pt-BR")}
                    </span>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex items-center gap-2">
                      <Progress
                        value={(u.total / maxTotal) * 100}
                        className="h-1.5 flex-1"
                      />
                      <span className="text-[10px] text-muted-foreground tabular-nums w-12 text-right">
                        {u.total.toLocaleString("pt-BR")}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
