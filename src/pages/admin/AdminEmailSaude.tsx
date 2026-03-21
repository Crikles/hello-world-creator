import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Ban, Clock, ChevronDown, ChevronRight, ShieldAlert } from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const NEGATIVE_STATUSES = ["bounced", "complained", "failed", "delivery_delayed"];

const PERIOD_OPTIONS = [
  { label: "7 dias", value: "7" },
  { label: "30 dias", value: "30" },
  { label: "90 dias", value: "90" },
];

interface EmailLog {
  id: string;
  loja_id: string;
  envio_id: string | null;
  evento_id: string | null;
  destinatario: string;
  status: string;
  created_at: string;
  updated_at: string | null;
}

interface Loja {
  id: string;
  nome: string;
  user_id: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface Evento {
  id: string;
  nome: string;
  status_label: string | null;
}

export default function AdminEmailSaude() {
  const [period, setPeriod] = useState("30");
  const [openUsers, setOpenUsers] = useState<Set<string>>(new Set());

  const since = useMemo(() => subDays(new Date(), parseInt(period)).toISOString(), [period]);

  // Fetch all negative email logs in period
  const { data: negativeLogs, isLoading: logsLoading } = useQuery({
    queryKey: ["admin-email-saude-negative", period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("postagem_email_log")
        .select("id, loja_id, envio_id, evento_id, destinatario, status, created_at, updated_at")
        .in("status", NEGATIVE_STATUSES)
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as EmailLog[];
    },
  });

  // Fetch total sent in period for percentage calculation
  const { data: totalSent } = useQuery({
    queryKey: ["admin-email-saude-total", period],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("postagem_email_log")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since);
      if (error) throw error;
      return count || 0;
    },
  });

  // Fetch all lojas
  const { data: lojas } = useQuery({
    queryKey: ["admin-all-lojas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lojas").select("id, nome, user_id");
      if (error) throw error;
      return data as Loja[];
    },
  });

  // Fetch all profiles
  const { data: profiles } = useQuery({
    queryKey: ["admin-all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email");
      if (error) throw error;
      return data as Profile[];
    },
  });

  // Fetch all eventos for stage names
  const { data: eventos } = useQuery({
    queryKey: ["admin-all-eventos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("postagem_eventos").select("id, nome, status_label");
      if (error) throw error;
      return data as Evento[];
    },
  });

  // Maps for quick lookup
  const lojaMap = useMemo(() => {
    const m = new Map<string, Loja>();
    lojas?.forEach((l) => m.set(l.id, l));
    return m;
  }, [lojas]);

  const profileMap = useMemo(() => {
    const m = new Map<string, Profile>();
    profiles?.forEach((p) => m.set(p.id, p));
    return m;
  }, [profiles]);

  const eventoMap = useMemo(() => {
    const m = new Map<string, Evento>();
    eventos?.forEach((e) => m.set(e.id, e));
    return m;
  }, [eventos]);

  // Group by user_id
  const userStats = useMemo(() => {
    if (!negativeLogs || !lojas) return [];

    const byUser = new Map<string, {
      userId: string;
      userName: string;
      userEmail: string;
      lojaNames: Set<string>;
      bounced: number;
      complained: number;
      failed: number;
      delivery_delayed: number;
      total: number;
      byEvento: Map<string, { nome: string; count: number }>;
    }>();

    for (const log of negativeLogs) {
      const loja = lojaMap.get(log.loja_id);
      if (!loja) continue;
      const userId = loja.user_id;
      const profile = profileMap.get(userId);

      if (!byUser.has(userId)) {
        byUser.set(userId, {
          userId,
          userName: profile?.full_name || "Sem nome",
          userEmail: profile?.email || "",
          lojaNames: new Set(),
          bounced: 0,
          complained: 0,
          failed: 0,
          delivery_delayed: 0,
          total: 0,
          byEvento: new Map(),
        });
      }

      const entry = byUser.get(userId)!;
      entry.lojaNames.add(loja.nome);
      entry.total++;

      if (log.status === "bounced") entry.bounced++;
      else if (log.status === "complained") entry.complained++;
      else if (log.status === "failed") entry.failed++;
      else if (log.status === "delivery_delayed") entry.delivery_delayed++;

      if (log.evento_id) {
        const evento = eventoMap.get(log.evento_id);
        const eventoNome = evento?.status_label || evento?.nome || "Desconhecido";
        if (!entry.byEvento.has(log.evento_id)) {
          entry.byEvento.set(log.evento_id, { nome: eventoNome, count: 0 });
        }
        entry.byEvento.get(log.evento_id)!.count++;
      }
    }

    return Array.from(byUser.values()).sort((a, b) => b.total - a.total);
  }, [negativeLogs, lojaMap, profileMap, eventoMap, lojas]);

  // Summary stats
  const stats = useMemo(() => {
    const s = { bounced: 0, complained: 0, failed: 0, delivery_delayed: 0, total: 0 };
    negativeLogs?.forEach((l) => {
      s.total++;
      if (l.status === "bounced") s.bounced++;
      else if (l.status === "complained") s.complained++;
      else if (l.status === "failed") s.failed++;
      else if (l.status === "delivery_delayed") s.delivery_delayed++;
    });
    return s;
  }, [negativeLogs]);

  const toggleUser = (userId: string) => {
    setOpenUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const statusBadge = (status: string, count: number) => {
    if (count === 0) return null;
    const variants: Record<string, string> = {
      bounced: "bg-red-500 hover:bg-red-600 text-white",
      complained: "bg-orange-500 hover:bg-orange-600 text-white",
      failed: "bg-red-700 hover:bg-red-800 text-white",
      delivery_delayed: "bg-yellow-500 hover:bg-yellow-600 text-black",
    };
    return (
      <Badge className={variants[status] || ""}>
        {count} {status}
      </Badge>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Saúde de Emails</h1>
            <p className="text-muted-foreground">
              Monitoramento de status negativos por usuário e etapa do fluxo.
            </p>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  Últimos {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bounces</CardTitle>
              <Ban className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.bounced}</div>
              <p className="text-xs text-muted-foreground">Emails rejeitados</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Complaints</CardTitle>
              <ShieldAlert className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.complained}</div>
              <p className="text-xs text-muted-foreground">Marcados como spam</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Falhas</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.failed}</div>
              <p className="text-xs text-muted-foreground">Erros de envio</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Atrasados</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.delivery_delayed}</div>
              <p className="text-xs text-muted-foreground">Entrega atrasada</p>
            </CardContent>
          </Card>
        </div>

        {/* Taxa geral */}
        {totalSent !== undefined && totalSent > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">Taxa de problemas no período:</span>
                <Badge variant={stats.total / totalSent > 0.05 ? "destructive" : "secondary"}>
                  {((stats.total / totalSent) * 100).toFixed(2)}% ({stats.total} de {totalSent})
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* User ranking table */}
        <Card>
          <CardHeader>
            <CardTitle>Usuários com Problemas de Entrega</CardTitle>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : userStats.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                Nenhum problema encontrado no período. 🎉
              </p>
            ) : (
              <div className="space-y-2">
                {userStats.map((user) => (
                  <Collapsible key={user.userId} open={openUsers.has(user.userId)}>
                    <div className="border rounded-lg">
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-between px-4 py-3 h-auto"
                          onClick={() => toggleUser(user.userId)}
                        >
                          <div className="flex items-center gap-4 text-left">
                            {openUsers.has(user.userId) ? (
                              <ChevronDown className="h-4 w-4 shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="font-medium truncate">{user.userName}</p>
                              <p className="text-xs text-muted-foreground truncate">{user.userEmail}</p>
                            </div>
                            <Badge variant="outline" className="shrink-0">
                              {Array.from(user.lojaNames).join(", ")}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {statusBadge("bounced", user.bounced)}
                            {statusBadge("complained", user.complained)}
                            {statusBadge("failed", user.failed)}
                            {statusBadge("delivery_delayed", user.delivery_delayed)}
                            <Badge variant="secondary">{user.total} total</Badge>
                          </div>
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 pb-4 pt-2">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Etapa do Fluxo</TableHead>
                                <TableHead className="text-right">Qtd. Problemas</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {user.byEvento.size === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                                    Sem dados de etapa disponíveis
                                  </TableCell>
                                </TableRow>
                              ) : (
                                Array.from(user.byEvento.entries())
                                  .sort((a, b) => b[1].count - a[1].count)
                                  .map(([eventoId, info]) => (
                                    <TableRow key={eventoId}>
                                      <TableCell>{info.nome}</TableCell>
                                      <TableCell className="text-right font-medium">
                                        {info.count}
                                      </TableCell>
                                    </TableRow>
                                  ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
