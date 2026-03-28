import { useState, useMemo, useCallback } from "react";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertTriangle, Ban, Clock, ChevronDown, ChevronRight, ShieldAlert,
  CalendarIcon, RefreshCw, Send, CircleAlert, CircleX, Download, Users,
} from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";

const NEGATIVE_STATUSES = ["bounced", "complained", "failed", "delivery_delayed"];

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
  ordem: number;
}

interface TodayFailure {
  id: string;
  destinatario: string;
  status: string;
  created_at: string;
  loja_id: string;
  evento_id: string | null;
  envio_id: string | null;
}

interface GroupedFailure {
  destinatario: string;
  status: string;
  loja_id: string;
  evento_id: string | null;
  envio_id: string | null;
  attempts: number;
  latest_at: string;
  isBounceRepeat: boolean;
}

export default function AdminEmailSaude() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [openUsers, setOpenUsers] = useState<Set<string>>(new Set());
  const [isResending, setIsResending] = useState(false);
  const [dryRunCount, setDryRunCount] = useState<number | null>(null);
  const [resendResults, setResendResults] = useState<{ destinatario: string; envio_id: string; status: "ok" | "erro"; erro?: string }[] | null>(null);

  const since = useMemo(
    () => (dateRange?.from ? startOfDay(dateRange.from).toISOString() : subDays(new Date(), 30).toISOString()),
    [dateRange?.from]
  );
  const until = useMemo(
    () => (dateRange?.to ? new Date(dateRange.to.getTime() + 86400000 - 1).toISOString() : new Date().toISOString()),
    [dateRange?.to]
  );

  const setPreset = (days: number) => {
    setDateRange({ from: subDays(new Date(), days), to: new Date() });
  };

  // Fetch negative email logs in period
  const { data: negativeLogs, isLoading: logsLoading } = useQuery({
    queryKey: ["admin-email-saude-negative", since, until],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("postagem_email_log")
        .select("id, loja_id, envio_id, evento_id, destinatario, status, created_at, updated_at")
        .in("status", NEGATIVE_STATUSES)
        .gte("created_at", since)
        .lte("created_at", until)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as EmailLog[];
    },
  });

  // Fetch total sent in period
  const { data: totalSent } = useQuery({
    queryKey: ["admin-email-saude-total", since, until],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("postagem_email_log")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since)
        .lte("created_at", until);
      if (error) throw error;
      return count || 0;
    },
  });

  // Today's failures
  const todayStart = useMemo(() => startOfDay(new Date()).toISOString(), []);
  const { data: todayFailures, isLoading: todayLoading, refetch: refetchToday } = useQuery({
    queryKey: ["admin-email-today-failures", todayStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("postagem_email_log")
        .select("id, destinatario, status, created_at, loja_id, evento_id, envio_id")
        .in("status", ["failed", "bounced"])
        .gte("created_at", todayStart)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as TodayFailure[];
    },
    refetchInterval: 30000,
  });

  // Group today's failures by destinatario+evento_id
  const groupedFailures = useMemo<GroupedFailure[]>(() => {
    if (!todayFailures?.length) return [];
    const map = new Map<string, GroupedFailure>();
    for (const f of todayFailures) {
      const key = `${f.destinatario}_${f.evento_id || "none"}`;
      if (!map.has(key)) {
        map.set(key, {
          destinatario: f.destinatario,
          status: f.status,
          loja_id: f.loja_id,
          evento_id: f.evento_id,
          envio_id: f.envio_id,
          attempts: 1,
          latest_at: f.created_at,
          isBounceRepeat: false,
        });
      } else {
        const existing = map.get(key)!;
        existing.attempts++;
        if (f.status === "bounced") existing.status = "bounced";
        if (existing.attempts >= 2 && existing.status === "bounced") {
          existing.isBounceRepeat = true;
        }
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      new Date(b.latest_at).getTime() - new Date(a.latest_at).getTime()
    );
  }, [todayFailures]);

  // Fetch all lojas, profiles, eventos
  const { data: lojas } = useQuery({
    queryKey: ["admin-all-lojas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lojas").select("id, nome, user_id");
      if (error) throw error;
      return data as Loja[];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["admin-all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email");
      if (error) throw error;
      return data as Profile[];
    },
  });

  const { data: eventos } = useQuery({
    queryKey: ["admin-all-eventos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("postagem_eventos").select("id, nome, status_label, ordem");
      if (error) throw error;
      return data as Evento[];
    },
  });

  // Maps
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

  // Set of evento IDs that are in the first 3 stages (ordem <= 3)
  const first3EventoIds = useMemo(() => {
    const s = new Set<string>();
    eventos?.forEach((e) => { if (e.ordem <= 3) s.add(e.id); });
    return s;
  }, [eventos]);

  // Group by user_id — track cashback-eligible clients (failed all 3 first stages)
  const userStats = useMemo(() => {
    if (!negativeLogs || !lojas) return [];

    // First pass: track per loja+destinatario which of the first 3 stages failed
    const destStages = new Map<string, { lojaId: string; stages: Set<number> }>();
    for (const log of negativeLogs) {
      if (!log.evento_id || !first3EventoIds.has(log.evento_id)) continue;
      const evento = eventoMap.get(log.evento_id);
      if (!evento) continue;
      const key = `${log.loja_id}__${log.destinatario}`;
      if (!destStages.has(key)) {
        destStages.set(key, { lojaId: log.loja_id, stages: new Set() });
      }
      destStages.get(key)!.stages.add(evento.ordem);
    }

    // Identify cashback-eligible destinatarios (failed all 3 first stages)
    const cashbackEligible = new Map<string, Set<string>>(); // lojaId -> Set<destinatario>
    for (const [key, info] of destStages) {
      if (info.stages.size >= 3) {
        const dest = key.split("__")[1];
        if (!cashbackEligible.has(info.lojaId)) cashbackEligible.set(info.lojaId, new Set());
        cashbackEligible.get(info.lojaId)!.add(dest);
      }
    }

    const byUser = new Map<string, {
      userId: string;
      userName: string;
      userEmail: string;
      lojaNames: Set<string>;
      lojaIds: Set<string>;
      uniqueDestinatarios: Set<string>;
      cashbackEligible: Set<string>;
      bounced: number;
      complained: number;
      failed: number;
      delivery_delayed: number;
      total: number;
      byEvento: Map<string, { nome: string; count: number; uniqueDestinatarios: Set<string> }>;
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
          lojaIds: new Set(),
          uniqueDestinatarios: new Set(),
          cashbackEligible: new Set(),
          bounced: 0, complained: 0, failed: 0, delivery_delayed: 0, total: 0,
          byEvento: new Map(),
        });
      }

      const entry = byUser.get(userId)!;
      entry.lojaNames.add(loja.nome);
      entry.lojaIds.add(loja.id);
      entry.total++;
      entry.uniqueDestinatarios.add(log.destinatario);

      // Check if this destinatario is cashback eligible for this loja
      if (cashbackEligible.get(log.loja_id)?.has(log.destinatario)) {
        entry.cashbackEligible.add(log.destinatario);
      }

      if (log.status === "bounced") entry.bounced++;
      else if (log.status === "complained") entry.complained++;
      else if (log.status === "failed") entry.failed++;
      else if (log.status === "delivery_delayed") entry.delivery_delayed++;

      if (log.evento_id) {
        const evento = eventoMap.get(log.evento_id);
        const eventoNome = evento?.status_label || evento?.nome || "Desconhecido";
        if (!entry.byEvento.has(log.evento_id)) {
          entry.byEvento.set(log.evento_id, { nome: eventoNome, count: 0, uniqueDestinatarios: new Set() });
        }
        const ev = entry.byEvento.get(log.evento_id)!;
        ev.count++;
        ev.uniqueDestinatarios.add(log.destinatario);
      }
    }

    return Array.from(byUser.values()).sort((a, b) => b.cashbackEligible.size - a.cashbackEligible.size);
  }, [negativeLogs, lojaMap, profileMap, eventoMap, lojas, first3EventoIds]);

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

  // CSV export for cashback-eligible leads
  const handleExportCSV = useCallback(async () => {
    // Collect all cashback-eligible destinatarios across all users
    const allEligible: { destinatario: string; lojaIds: string[] }[] = [];
    for (const user of userStats) {
      if (user.cashbackEligible.size === 0) continue;
      for (const dest of user.cashbackEligible) {
        const lojaIds = Array.from(user.lojaIds);
        allEligible.push({ destinatario: dest, lojaIds });
      }
    }

    if (allEligible.length === 0) {
      toast.info("Nenhum cliente elegível para cashback no período");
      return;
    }

    toast.loading("Gerando relatório...", { id: "csv-export" });

    try {
      // Fetch leads data for these destinatarios
      const allEmails = allEligible.map(e => e.destinatario);
      // Fetch in batches of 100
      const allLeads: any[] = [];
      for (let i = 0; i < allEmails.length; i += 100) {
        const batch = allEmails.slice(i, i + 100);
        const { data } = await supabase
          .from("leads")
          .select("nome, email, cpf, telefone, produto, valor, endereco, numero, bairro, complemento, cidade, estado, cep, loja_id")
          .in("email", batch);
        if (data) allLeads.push(...data);
      }

      // Build CSV rows
      const header = "Nome,Email,CPF,Telefone,Produto,Valor,Endereço,Número,Bairro,Complemento,Cidade,Estado,CEP,Loja,Etapas Falhadas";
      const csvRows = [header];

      for (const lead of allLeads) {
        const loja = lead.loja_id ? lojaMap.get(lead.loja_id) : null;
        // Find which stages failed for this lead
        const failedStages: string[] = [];
        if (negativeLogs) {
          const stageSet = new Set<string>();
          for (const log of negativeLogs) {
            if (log.destinatario === lead.email && log.evento_id) {
              const ev = eventoMap.get(log.evento_id);
              if (ev && ev.ordem <= 3 && !stageSet.has(ev.status_label || ev.nome)) {
                stageSet.add(ev.status_label || ev.nome);
              }
            }
          }
          failedStages.push(...stageSet);
        }

        const escape = (v: any) => {
          const s = String(v ?? "").replace(/"/g, '""');
          return `"${s}"`;
        };

        csvRows.push([
          escape(lead.nome),
          escape(lead.email),
          escape(lead.cpf),
          escape(lead.telefone),
          escape(lead.produto),
          escape(lead.valor),
          escape(lead.endereco),
          escape(lead.numero),
          escape(lead.bairro),
          escape(lead.complemento),
          escape(lead.cidade),
          escape(lead.estado),
          escape(lead.cep),
          escape(loja?.nome),
          escape(failedStages.join(", ")),
        ].join(","));
      }

      // Also add eligible destinatarios not found in leads
      const leadEmails = new Set(allLeads.map((l: any) => l.email));
      for (const e of allEligible) {
        if (!leadEmails.has(e.destinatario)) {
          const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
          csvRows.push([
            escape(""),
            escape(e.destinatario),
            escape(""), escape(""), escape(""), escape(""),
            escape(""), escape(""), escape(""), escape(""),
            escape(""), escape(""), escape(""),
            escape(e.lojaIds.map(id => lojaMap.get(id)?.nome || "").join(", ")),
            escape("Postado, Coletado, Em Trânsito"),
          ].join(","));
        }
      }

      const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clientes-cashback-${format(new Date(), "yyyy-MM-dd")}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`Relatório exportado com ${csvRows.length - 1} clientes`, { id: "csv-export" });
    } catch (e) {
      toast.error("Erro ao gerar relatório: " + (e as Error).message, { id: "csv-export" });
    }
  }, [userStats, lojaMap, eventoMap, negativeLogs]);

    setIsResending(true);
    setResendResults(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) { toast.error("Sessão expirada"); return; }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const baseUrl = `https://${projectId}.supabase.co/functions/v1`;

      // Dry run first to get real count
      const dryRes = await fetch(`${baseUrl}/resend-daily-emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dry_run: true, mode: "failed" }),
      });

      if (!dryRes.ok) {
        toast.error("Erro ao verificar emails falhados");
        return;
      }

      const { total } = await dryRes.json();
      setDryRunCount(total);

      if (total === 0) {
        toast.info("Nenhum email elegível para reenvio (bounce repetido ou já reenviado com sucesso)");
        return;
      }

      const confirmed = window.confirm(
        `Reenviar ${total} email(s) falhado(s) de hoje?\n\n` +
        `(Emails com bounce repetido são limitados a 2 tentativas por dia)`
      );
      if (!confirmed) return;

      toast.loading("Reenviando emails...", { id: "resend" });

      const res = await fetch(`${baseUrl}/resend-daily-emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dry_run: false, mode: "failed" }),
      });

      if (!res.ok) throw new Error("Falha no reenvio");

      const result = await res.json();
      setResendResults(result.results || []);
      toast.success(`Reenvio concluído: ${result.success} ✅, ${result.failed} ❌`, { id: "resend" });
      refetchToday();
    } catch (e) {
      toast.error("Erro ao reenviar: " + (e as Error).message, { id: "resend" });
    } finally {
      setIsResending(false);
    }
  };

  const statusBadge = (status: string, count: number) => {
    if (count === 0) return null;
    const variants: Record<string, string> = {
      bounced: "bg-red-500 hover:bg-red-600 text-white",
      complained: "bg-orange-500 hover:bg-orange-600 text-white",
      failed: "bg-red-700 hover:bg-red-800 text-white",
      delivery_delayed: "bg-yellow-500 hover:bg-yellow-600 text-black",
    };
    return <Badge className={variants[status] || ""}>{count} {status}</Badge>;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header with date picker */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Saúde de Emails</h1>
            <p className="text-muted-foreground">
              Monitoramento de status negativos por usuário e etapa do fluxo.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setPreset(0)}>Hoje</Button>
            <Button variant="outline" size="sm" onClick={() => setPreset(7)}>7d</Button>
            <Button variant="outline" size="sm" onClick={() => setPreset(30)}>30d</Button>
            <Button variant="outline" size="sm" onClick={() => setPreset(90)}>90d</Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>{format(dateRange.from, "dd/MM", { locale: ptBR })} - {format(dateRange.to, "dd/MM", { locale: ptBR })}</>
                    ) : format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                  ) : "Selecionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  locale={ptBR}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Today's Failures + Resend */}
        <Card className="border-destructive/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Falhas de Hoje
              {todayFailures && todayFailures.length > 0 && groupedFailures.length < todayFailures.length && (
                <span className="text-xs text-muted-foreground font-normal">
                  ({groupedFailures.length} únicos de {todayFailures.length} registros)
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => refetchToday()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleResendFailed}
                disabled={isResending || !groupedFailures?.length}
              >
                {isResending ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Reenviar Falhas ({dryRunCount !== null ? dryRunCount : groupedFailures.length})
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {todayLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !groupedFailures?.length ? (
              <p className="text-center py-4 text-muted-foreground">Nenhuma falha hoje 🎉</p>
            ) : (
              <div className="max-h-64 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Destinatário</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tentativas</TableHead>
                      <TableHead>Etapa</TableHead>
                      <TableHead>Loja</TableHead>
                      <TableHead>Última</TableHead>
                      <TableHead>Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedFailures.map((f, idx) => {
                      const evento = f.evento_id ? eventoMap.get(f.evento_id) : null;
                      const loja = lojaMap.get(f.loja_id);
                      return (
                        <TableRow key={`${f.destinatario}-${f.evento_id}-${idx}`}>
                          <TableCell className="font-mono text-xs">{f.destinatario}</TableCell>
                          <TableCell>
                            <Badge className={f.status === "bounced" ? "bg-red-500 text-white" : "bg-red-700 text-white"}>
                              {f.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              x{f.attempts}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{evento?.status_label || evento?.nome || "—"}</TableCell>
                          <TableCell className="text-sm">{loja?.nome || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(f.latest_at), "HH:mm")}
                          </TableCell>
                          <TableCell>
                            {f.isBounceRepeat ? (
                              <span className="flex items-center gap-1 text-xs text-red-500" title="Email provavelmente inválido — bounce repetido">
                                <CircleX className="h-4 w-4" />
                                Inválido
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-green-600" title="Vale tentar reenviar">
                                <CircleAlert className="h-4 w-4" />
                                Reenviar
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resend Results */}
        {resendResults && resendResults.length > 0 && (
          <Card className="border-primary/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Send className="h-5 w-5 text-primary" />
                Resultado do Reenvio
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setResendResults(null)}>
                Fechar
              </Button>
            </CardHeader>
            <CardContent>
              <div className="max-h-48 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Destinatário</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead>Detalhes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resendResults.map((r, idx) => (
                      <TableRow key={`result-${idx}`}>
                        <TableCell className="font-mono text-xs">{r.destinatario}</TableCell>
                        <TableCell>
                          {r.status === "ok" ? (
                            <Badge className="bg-green-600 text-white">✅ Enviado</Badge>
                          ) : (
                            <Badge className="bg-red-600 text-white">❌ Falhou</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.status === "ok" ? "Email reenviado com sucesso" : r.erro || "Erro desconhecido"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

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
                            <Badge className="bg-primary hover:bg-primary/90 text-primary-foreground">
                              {user.uniqueDestinatarios.size} {user.uniqueDestinatarios.size === 1 ? "cliente afetado" : "clientes afetados"}
                            </Badge>
                            {statusBadge("bounced", user.bounced)}
                            {statusBadge("complained", user.complained)}
                            {statusBadge("failed", user.failed)}
                            {statusBadge("delivery_delayed", user.delivery_delayed)}
                            <Badge variant="secondary">{user.total} emails</Badge>
                          </div>
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 pb-4 pt-2">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Etapa do Fluxo</TableHead>
                                <TableHead className="text-right">Clientes Únicos</TableHead>
                                <TableHead className="text-right">Total Emails</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {user.byEvento.size === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                                    Sem dados de etapa disponíveis
                                  </TableCell>
                                </TableRow>
                              ) : (
                                Array.from(user.byEvento.entries())
                                  .sort((a, b) => b[1].uniqueDestinatarios.size - a[1].uniqueDestinatarios.size)
                                  .map(([eventoId, info]) => (
                                    <TableRow key={eventoId}>
                                      <TableCell>{info.nome}</TableCell>
                                      <TableCell className="text-right font-medium">
                                        {info.uniqueDestinatarios.size}
                                      </TableCell>
                                      <TableCell className="text-right text-muted-foreground">
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
