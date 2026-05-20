import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { HardDrive, Database, Trash2, Activity, Info, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type TableStat = {
  table_name: string;
  size_bytes: number;
  size_pretty: string;
  row_estimate: number;
  dead_tuples?: number;
  live_tuples?: number;
  bloat_ratio?: number;
};
type Stats = {
  db_size_bytes: number;
  db_size_pretty: string;
  tables: TableStat[];
  cleanup_candidates?: Partial<Record<CleanupAction, number>>;
  total_dead_tuples?: number;
  total_live_tuples?: number;
  bloat_estimate_pct?: number;
  generated_at: string;
};

const FRIENDLY_NAMES: Record<string, string> = {
  pedidos: "Pedidos (raw checkout)",
  webhook_logs: "Logs de Webhooks",
  whatsapp_send_queue: "Fila WhatsApp",
  postagem_email_log: "Logs de E-mail",
  envios: "Envios",
  leads: "Leads",
  creditos_transacoes: "Transações de Crédito",
  confirmacao_pagamento_log: "Logs Confirmação de Pagamento",
  live_view_pings: "Pings (Live View)",
  push_subscriptions: "Inscrições Push",
  recovery_leads: "Leads de Recuperação",
  pix_payments: "Pagamentos PIX",
};

const formatMB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

// Soft cap reference: avisamos amarelo > 800MB e vermelho > 1.2GB
const SOFT_CAP_BYTES = 1_500 * 1024 * 1024;

type CleanupAction = "pedidos_payloads" | "webhook_logs" | "whatsapp_queue" | "internal_logs";

const ACTION_META: Record<CleanupAction, { label: string; description: string; impact: string }> = {
  pedidos_payloads: {
    label: "Limpar payloads brutos de pedidos",
    description:
      "Remove o JSON original do checkout em pedidos com mais de 30 dias. Os dados do cliente, valor, status e endereço continuam intactos — só removemos a cópia bruta da requisição que já foi processada.",
    impact: "Não afeta nenhuma operação. Apenas libera espaço.",
  },
  webhook_logs: {
    label: "Limpar payloads de webhooks processados",
    description:
      "Esvazia o JSON dos webhooks já processados há mais de 30 dias. Mantém o histórico (data, tipo, status), só remove o conteúdo bruto que não é mais consultado.",
    impact: "Não afeta nenhuma operação.",
  },
  whatsapp_queue: {
    label: "Limpar fila de WhatsApp finalizada",
    description:
      "Apaga mensagens da fila com status 'enviada', 'falha' ou 'cancelada' há mais de 15 dias. Mensagens pendentes nunca são tocadas.",
    impact: "Não afeta envios em andamento ou agendamentos futuros.",
  },
  internal_logs: {
    label: "Limpar logs internos do sistema",
    description:
      "Remove logs de execução de cron (>7 dias) e logs de chamadas HTTP internas (>3 dias). São logs de diagnóstico que o sistema gera automaticamente.",
    impact: "Não afeta nenhuma operação visível ao usuário.",
  },
};

export function CloudUsagePanel() {
  const qc = useQueryClient();
  const [pendingAction, setPendingAction] = useState<CleanupAction | null>(null);
  const [recentRuns, setRecentRuns] = useState<Partial<Record<CleanupAction, number>>>({});

  useEffect(() => {
    if (stats?.generated_at) {
      setRecentRuns({});
    }
  }, [stats?.generated_at]);

  const { data: stats, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["cloud-usage-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cloud_usage_stats" as any);
      if (error) throw error;
      return data as Stats;
    },
    refetchInterval: 60_000,
  });

  const { data: history } = useQuery({
    queryKey: ["cleanup-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cleanup_history" as any)
        .select("*")
        .order("executed_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data as unknown) as Array<{ id: string; action: string; rows_affected: number; executed_at: string }>;
    },
  });

  const cleanupMutation = useMutation({
    mutationFn: async (action: CleanupAction) => {
      const fn =
        action === "pedidos_payloads" ? "cleanup_pedidos_payloads" :
        action === "webhook_logs" ? "cleanup_webhook_logs" :
        action === "whatsapp_queue" ? "cleanup_whatsapp_queue" : "cleanup_internal_logs";
      const { data, error } = await supabase.rpc(fn as any);
      if (error) throw error;
      return { action, data };
    },
    onSuccess: ({ action, data }) => {
      const rows = (data as any)?.rows_affected ?? ((data as any)?.cron_logs ?? 0) + ((data as any)?.pg_net_logs ?? 0);
      setRecentRuns((prev) => ({ ...prev, [action]: rows }));
      toast.success(
        `${ACTION_META[action].label}`,
        {
          description: `${rows.toLocaleString("pt-BR")} registros tratados. O espaço será reaproveitado nas próximas inserções (o tamanho exibido só diminui após manutenção da Lovable Cloud).`,
          duration: 8000,
        }
      );
      qc.invalidateQueries({ queryKey: ["cloud-usage-stats"] });
      qc.invalidateQueries({ queryKey: ["cleanup-history"] });
      refetch();
    },
    onError: (err: Error) => toast.error(`Falha: ${err.message}`),
    onSettled: () => setPendingAction(null),
  });

  const dbBytes = stats?.db_size_bytes ?? 0;
  const usagePct = Math.min(100, (dbBytes / SOFT_CAP_BYTES) * 100);
  const healthLevel: "ok" | "warn" | "critical" =
    usagePct < 50 ? "ok" : usagePct < 80 ? "warn" : "critical";
  const healthColor =
    healthLevel === "ok" ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" :
    healthLevel === "warn" ? "text-amber-400 border-amber-500/30 bg-amber-500/10" :
    "text-red-400 border-red-500/30 bg-red-500/10";
  const healthLabel =
    healthLevel === "ok" ? "Saudável" : healthLevel === "warn" ? "Atenção" : "Crítico";

  const effectiveCandidates = useMemo(() => {
    const base = stats?.cleanup_candidates ?? {};
    return (Object.keys(ACTION_META) as CleanupAction[]).reduce((acc, key) => {
      acc[key] = Math.max(0, (base[key] ?? 0) - (recentRuns[key] ?? 0));
      return acc;
    }, {} as Record<CleanupAction, number>);
  }, [stats?.cleanup_candidates, recentRuns]);

  // Recomendações dinâmicas
  const recs: Array<{ kind: "warn" | "info" | "ok"; text: string }> = [];
  if (stats) {
    const pedidos = stats.tables.find(t => t.table_name === "pedidos");
    const webhooks = stats.tables.find(t => t.table_name === "webhook_logs");
    const wa = stats.tables.find(t => t.table_name === "whatsapp_send_queue");
    if ((effectiveCandidates.pedidos_payloads ?? 0) > 0 && pedidos)
      recs.push({ kind: "warn", text: `Ainda há ${(effectiveCandidates.pedidos_payloads ?? 0).toLocaleString("pt-BR")} pedidos com payload bruto limpável em "Pedidos" (${formatMB(pedidos.size_bytes)} na tabela).` });
    if ((effectiveCandidates.webhook_logs ?? 0) > 0 && webhooks)
      recs.push({ kind: "warn", text: `Ainda há ${(effectiveCandidates.webhook_logs ?? 0).toLocaleString("pt-BR")} webhooks processados com payload bruto que podem ser limpos.` });
    if ((effectiveCandidates.whatsapp_queue ?? 0) > 0 && wa)
      recs.push({ kind: "info", text: `Ainda há ${(effectiveCandidates.whatsapp_queue ?? 0).toLocaleString("pt-BR")} itens finalizados na fila WhatsApp prontos para remoção.` });
    if ((effectiveCandidates.internal_logs ?? 0) > 0)
      recs.push({ kind: "info", text: `Ainda há ${(effectiveCandidates.internal_logs ?? 0).toLocaleString("pt-BR")} logs internos antigos que podem ser removidos.` });
    if (healthLevel === "critical")
      recs.push({ kind: "warn", text: "Banco passou de 80% da capacidade de referência — considere upgrade da instância na Lovable Cloud (Backend → Configurações avançadas)." });
    if (recs.length === 0)
      recs.push({ kind: "ok", text: "Tudo em ordem — não há itens antigos pendentes de limpeza neste momento." });
  }

  const totalRows = stats?.tables.reduce((s, t) => s + (t.row_estimate || 0), 0) ?? 0;
  const lastCleanup = history?.[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
            <HardDrive className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Uso da Cloud</h2>
            <p className="text-xs text-muted-foreground">Monitoramento de armazenamento e ações de limpeza</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tamanho do Banco</CardTitle>
            <Database className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{stats?.db_size_pretty ?? "—"}</p>
            <Progress value={usagePct} className="h-1.5 mt-3" />
            <p className="text-xs text-muted-foreground mt-1">{usagePct.toFixed(0)}% da referência ({formatMB(SOFT_CAP_BYTES)})</p>
            {stats?.bloat_estimate_pct !== undefined && stats.bloat_estimate_pct > 0 && (
              <p className="text-[10px] text-amber-400/80 mt-1">
                ~{stats.bloat_estimate_pct}% é espaço reaproveitável
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total de Registros</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{totalRows.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground mt-3">Estimativa entre as principais tabelas</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status da Instância</CardTitle>
            <Sparkles className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <Badge className={`${healthColor} border`}>{healthLabel}</Badge>
            <p className="text-xs text-muted-foreground mt-3">Baseado no consumo atual</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Itens Limpáveis</CardTitle>
            <Trash2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {Object.values(effectiveCandidates).reduce((sum, value) => sum + value, 0).toLocaleString("pt-BR")}
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              Registros ainda elegíveis para limpeza segura agora
            </p>
            {lastCleanup && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Última execução {formatDistanceToNow(new Date(lastCleanup.executed_at), { locale: ptBR, addSuffix: true })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recomendações */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" /> Recomendações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            recs.map((r, i) => (
              <div key={i} className={`text-sm px-3 py-2 rounded-lg border ${
                r.kind === "warn" ? "border-amber-500/30 bg-amber-500/5 text-amber-200" :
                r.kind === "ok" ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-200" :
                "border-border/50 bg-secondary/30 text-foreground"
              }`}>
                {r.text}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Top tabelas */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Top tabelas por consumo</span>
            <span className="text-[10px] font-normal text-muted-foreground">
              barra amarela = espaço reaproveitável
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <div className="space-y-2">
              {stats?.tables.slice(0, 12).map((t) => {
                const pct = (t.size_bytes / dbBytes) * 100;
                const bloat = t.bloat_ratio ?? 0;
                const flag =
                  t.size_bytes > 200 * 1024 * 1024 ? { c: "bg-red-500/20 text-red-300", l: "Limpar" } :
                  t.size_bytes > 50 * 1024 * 1024 ? { c: "bg-amber-500/20 text-amber-300", l: "Atenção" } :
                  { c: "bg-emerald-500/20 text-emerald-300", l: "OK" };
                return (
                  <div key={t.table_name} className="space-y-1">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-foreground truncate">
                        {FRIENDLY_NAMES[t.table_name] ?? t.table_name}
                        <span className="text-xs text-muted-foreground ml-2">({t.row_estimate.toLocaleString("pt-BR")} regs)</span>
                        {bloat > 10 && (
                          <span className="text-[10px] text-amber-400/80 ml-2">• {bloat}% reaproveitável</span>
                        )}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="tabular-nums text-muted-foreground">{t.size_pretty}</span>
                        <span className="tabular-nums text-xs text-muted-foreground w-12 text-right">{pct.toFixed(1)}%</span>
                        <Badge className={`${flag.c} border-0 text-xs`}>{flag.l}</Badge>
                      </div>
                    </div>
                    <div className="relative h-1 bg-secondary/50 rounded-full overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-primary rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                      {bloat > 0 && (
                        <div
                          className="absolute inset-y-0 bg-amber-500/60 rounded-r-full"
                          style={{
                            right: `${100 - pct}%`,
                            width: `${pct * (bloat / 100)}%`,
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nota explicativa sobre espaço reaproveitável */}
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="pt-4 text-xs space-y-2">
          <p className="flex items-start gap-2">
            <Info className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span className="text-amber-100/90">
              <strong>Por que o tamanho não diminui logo após limpar?</strong> O PostgreSQL marca o espaço como
              <strong> reaproveitável</strong> em vez de devolvê-lo ao disco. Novos registros usam esse espaço
              primeiro, então o banco não cresce mesmo com inserções constantes.
            </span>
          </p>
          <p className="text-muted-foreground pl-5">
            Para encolher os arquivos fisicamente é preciso <code className="text-[10px] bg-background/40 px-1 rounded">VACUUM FULL</code>,
            executado pela própria Lovable Cloud — geralmente após restart da instância ou via suporte. Como o
            espaço já é reaproveitado, isso quase nunca é urgente.
          </p>
        </CardContent>
      </Card>

      {/* Ações de limpeza */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Ações de limpeza segura</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(ACTION_META) as CleanupAction[]).map((act) => (
            <div key={act} className="border border-border/50 rounded-lg p-4 space-y-2 bg-secondary/20">
              <h4 className="text-sm font-semibold">{ACTION_META[act].label}</h4>
              <p className="text-xs text-muted-foreground">{ACTION_META[act].description}</p>
              <p className="text-xs text-muted-foreground">
                Pendentes agora: <span className="font-semibold text-foreground">{(effectiveCandidates[act] ?? 0).toLocaleString("pt-BR")}</span>
              </p>
              <p className="text-xs text-emerald-400">✓ {ACTION_META[act].impact}</p>
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-2 mt-2"
                onClick={() => setPendingAction(act)}
                disabled={cleanupMutation.isPending || (effectiveCandidates[act] ?? 0) === 0}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {(effectiveCandidates[act] ?? 0) === 0 ? "Nada para limpar" : "Executar"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Histórico de limpezas (últimas 10)</CardTitle>
        </CardHeader>
        <CardContent>
          {history && history.length > 0 ? (
            <div className="space-y-1.5">
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-md bg-secondary/30 border border-border/30">
                  <span className="font-medium">{h.action}</span>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>{h.rows_affected.toLocaleString("pt-BR")} regs</span>
                    <span>{formatDistanceToNow(new Date(h.executed_at), { locale: ptBR, addSuffix: true })}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma limpeza executada ainda.</p>
          )}
        </CardContent>
      </Card>

      {/* Aviso sobre métricas externas */}
      <Card className="border-border/50 bg-secondary/20">
        <CardContent className="pt-4 text-xs text-muted-foreground space-y-1">
          <p><strong className="text-foreground">CPU, memória e custos detalhados:</strong> consulte o painel da Lovable Cloud (Backend → Configurações avançadas) — esses dados não são expostos aqui.</p>
          <p><strong className="text-foreground">Storage de arquivos</strong> (logos, NFE, PIX) é faturado separadamente do banco de dados.</p>
        </CardContent>
      </Card>

      {/* Confirmação */}
      <AlertDialog open={!!pendingAction} onOpenChange={(o) => !o && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingAction ? ACTION_META[pendingAction].label : ""}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction ? ACTION_META[pendingAction].description : ""}
              <br /><br />
              <span className="text-emerald-400">{pendingAction ? ACTION_META[pendingAction].impact : ""}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (pendingAction) cleanupMutation.mutate(pendingAction);
              }}
            >
              Executar limpeza
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
