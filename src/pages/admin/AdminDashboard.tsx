import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import {
  Users, Store, Package, Coins, Contact, RefreshCw,
  Mail, CheckCircle2, XCircle, TrendingUp, ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { SystemHealth } from "@/components/admin/SystemHealth";

export default function AdminDashboard() {
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [profiles, lojas, envios, creditos, leads] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("lojas").select("id", { count: "exact", head: true }),
        supabase.from("envios").select("id", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("creditos").select("saldo"),
        supabase.from("leads").select("id", { count: "exact", head: true }),
      ]);
      const totalCreditos = (creditos.data || []).reduce((sum, c) => sum + (c.saldo || 0), 0);
      return {
        usuarios: profiles.count || 0,
        lojas: lojas.count || 0,
        envios: envios.count || 0,
        creditos: totalCreditos,
        leads: leads.count || 0,
      };
    },
  });

  // Email stats for today
  const { data: emailStats } = useQuery({
    queryKey: ["admin-email-stats-today"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      // Fetch all logs with pagination to avoid 1k limit
      const PAGE_SIZE = 1000;
      let allLogs: { status: string; custo: number }[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: logs } = await supabase
          .from("postagem_email_log")
          .select("status, custo")
          .gte("created_at", todayISO)
          .range(offset, offset + PAGE_SIZE - 1);

        if (logs && logs.length > 0) {
          allLogs = allLogs.concat(logs);
          offset += PAGE_SIZE;
          hasMore = logs.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }

      const total = allLogs.length;
      const sent = allLogs.filter((l) => l.status === "sent").length;
      const failed = allLogs.filter((l) => l.status === "failed").length;
      const pending = allLogs.filter((l) => l.status === "pending").length;
      const custo = allLogs.reduce((s, l) => s + (l.custo || 0), 0);

      return { total, sent, failed, pending, custo };
    },
    refetchInterval: 30000,
  });

  // Dry run count for resend
  const { data: emailCount, isLoading: loadingCount } = useQuery({
    queryKey: ["admin-resend-count"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("resend-daily-emails", {
        body: { dry_run: true },
      });
      if (error) throw error;
      return data?.total ?? 0;
    },
  });

  const resendMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("resend-daily-emails", {
        body: { dry_run: false },
      });
      if (error) throw error;
      return data as { total: number; success: number; failed: number };
    },
    onSuccess: (data) => {
      toast.success(`Reenvio concluído: ${data.success} enviados, ${data.failed} falhas`);
    },
    onError: (err: Error) => {
      toast.error(`Erro ao reenviar: ${err.message}`);
    },
  });

  const mainCards = [
    { title: "Usuários", value: stats?.usuarios ?? 0, icon: Users, color: "from-blue-500/20 to-blue-600/5" },
    { title: "Lojas", value: stats?.lojas ?? 0, icon: Store, color: "from-purple-500/20 to-purple-600/5" },
    { title: "Envios", value: stats?.envios ?? 0, icon: Package, color: "from-emerald-500/20 to-emerald-600/5" },
    { title: "Créditos", value: stats?.creditos ?? 0, icon: Coins, color: "from-primary/20 to-primary/5" },
    { title: "Leads", value: stats?.leads ?? 0, icon: Contact, color: "from-rose-500/20 to-rose-600/5" },
  ];

  const emailCards = [
    { title: "Total Enviados", value: emailStats?.total ?? 0, icon: Mail, accent: "text-primary" },
    { title: "Sucesso", value: emailStats?.sent ?? 0, icon: CheckCircle2, accent: "text-emerald-400" },
    { title: "Falhas", value: emailStats?.failed ?? 0, icon: XCircle, accent: "text-red-400" },
    { title: "Custo Total", value: `R$ ${(emailStats?.custo ?? 0).toFixed(2)}`, icon: TrendingUp, accent: "text-primary" },
  ];

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão geral do sistema</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Main Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {mainCards.map((card) => (
              <Card key={card.title} className="relative overflow-hidden border-border/50 hover:border-primary/30 transition-colors group">
                <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
                <CardHeader className="relative flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {card.title}
                  </CardTitle>
                  <div className="p-2 rounded-lg bg-secondary/50">
                    <card.icon className="h-4 w-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent className="relative">
                  <p className="text-2xl font-bold text-foreground tabular-nums">
                    {typeof card.value === "number" ? card.value.toLocaleString("pt-BR") : card.value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Email Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Emails Hoje</h2>
                  <p className="text-xs text-muted-foreground">Resumo de disparos do dia</p>
                </div>
              </div>

              <Button
                variant="outline"
                className="gap-2 border-primary/30 hover:bg-primary/10 hover:border-primary/50"
                disabled={resendMutation.isPending}
                onClick={() => setDialogOpen(true)}
              >
                <RefreshCw className={`h-4 w-4 ${resendMutation.isPending ? "animate-spin" : ""}`} />
                Reenviar Emails
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {emailCards.map((card) => (
                <Card key={card.title} className="border-border/50 hover:border-primary/20 transition-colors">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.title}</span>
                      <card.icon className={`h-4 w-4 ${card.accent}`} />
                    </div>
                    <p className="text-3xl font-bold text-foreground tabular-nums">
                      {typeof card.value === "number" ? card.value.toLocaleString("pt-BR") : card.value}
                    </p>
                    {card.title === "Total Enviados" && emailStats && emailStats.pending > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">{emailStats.pending} pendentes</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          {/* System Health */}
          <SystemHealth />
        </div>
        </div>
      )}

      {/* Resend Dialog */}
      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reenviar todos os emails de hoje?</AlertDialogTitle>
            <AlertDialogDescription>
              {loadingCount
                ? "Calculando..."
                : `Serão reenviados ${emailCount ?? 0} emails únicos com os links atualizados. Esta ação pode levar alguns minutos.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {resendMutation.isPending && (
            <div className="py-2">
              <Progress value={undefined} className="h-2 animate-pulse" />
              <p className="text-xs text-muted-foreground mt-2">Reenviando emails... Isso pode demorar.</p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resendMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={resendMutation.isPending || !emailCount}
              onClick={(e) => {
                e.preventDefault();
                resendMutation.mutate(undefined, {
                  onSettled: () => setDialogOpen(false),
                });
              }}
            >
              {resendMutation.isPending ? "Reenviando..." : "Confirmar Reenvio"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
