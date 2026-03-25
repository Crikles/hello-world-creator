import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Undo2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminCashback() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: cashbacks = [], isLoading } = useQuery({
    queryKey: ["admin-cashbacks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cashback_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;

      // Fetch profiles and envios for display
      const userIds = [...new Set((data || []).map((c: any) => c.user_id))];
      const envioIds = [...new Set((data || []).map((c: any) => c.envio_id))];

      const [profilesRes, enviosRes] = await Promise.all([
        userIds.length > 0
          ? supabase.from("profiles").select("id, full_name, email").in("id", userIds)
          : { data: [] },
        envioIds.length > 0
          ? supabase.from("envios").select("id, cliente_nome, cliente_email, produto").in("id", envioIds)
          : { data: [] },
      ]);

      const profiles = profilesRes.data || [];
      const envios = enviosRes.data || [];

      return (data || []).map((c: any) => {
        const profile = profiles.find((p: any) => p.id === c.user_id);
        const envio = envios.find((e: any) => e.id === c.envio_id);
        return {
          ...c,
          user_name: profile?.full_name || profile?.email || c.user_id,
          cliente_nome: envio?.cliente_nome || "—",
          cliente_email: envio?.cliente_email || "—",
          produto: envio?.produto || "—",
        };
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (cashbackId: string) => {
      const { data, error } = await supabase.rpc("approve_cashback" as any, {
        _cashback_id: cashbackId,
        _admin_id: user?.id,
      });
      if (error) throw error;
      if (!data) throw new Error("Falha ao aprovar cashback");
      return data;
    },
    onSuccess: () => {
      toast.success("Cashback aprovado! 0,50 moedas creditadas.");
      queryClient.invalidateQueries({ queryKey: ["admin-cashbacks"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async (cashbackId: string) => {
      const { data, error } = await supabase.rpc("reject_cashback" as any, {
        _cashback_id: cashbackId,
        _admin_id: user?.id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Cashback rejeitado.");
      queryClient.invalidateQueries({ queryKey: ["admin-cashbacks"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const pendingCount = cashbacks.filter((c: any) => c.status === "pendente").length;
  const approvedCount = cashbacks.filter((c: any) => c.status === "aprovado").length;
  const totalDevolvido = cashbacks
    .filter((c: any) => c.status === "aprovado")
    .reduce((s: number, c: any) => s + (c.valor_devolvido || 0), 0);

  const statusBadge = (status: string) => {
    switch (status) {
      case "pendente":
        return <Badge variant="outline" className="text-amber-400 border-amber-400/30"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case "aprovado":
        return <Badge variant="default" className="bg-emerald-500/20 text-emerald-400 border-emerald-400/30"><CheckCircle2 className="h-3 w-3 mr-1" />Aprovado</Badge>;
      case "rejeitado":
        return <Badge variant="destructive" className="text-xs"><XCircle className="h-3 w-3 mr-1" />Rejeitado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-foreground mb-6">Cashback — Aprovação Manual</h1>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Card className="border-border/50">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Pendentes</p>
            <p className="text-2xl font-bold text-amber-400">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Aprovados</p>
            <p className="text-2xl font-bold text-emerald-400">{approvedCount}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Devolvido</p>
            <p className="text-2xl font-bold text-primary">{totalDevolvido.toFixed(2)} moedas</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Solicitações de Cashback</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : cashbacks.length === 0 ? (
            <div className="text-center py-8">
              <Undo2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma solicitação de cashback.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cashbacks.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">{format(new Date(c.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell className="font-medium text-sm">{c.user_name}</TableCell>
                    <TableCell className="text-sm">
                      <div>{c.cliente_nome}</div>
                      <div className="text-xs text-muted-foreground">{c.cliente_email}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{c.produto}</TableCell>
                    <TableCell className="text-sm font-medium text-primary">{Number(c.valor_devolvido).toFixed(2)}</TableCell>
                    <TableCell>{statusBadge(c.status)}</TableCell>
                    <TableCell>
                      {c.status === "pendente" ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                            disabled={approveMutation.isPending}
                            onClick={() => approveMutation.mutate(c.id)}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                            disabled={rejectMutation.isPending}
                            onClick={() => rejectMutation.mutate(c.id)}
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Rejeitar
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {c.approved_at ? format(new Date(c.approved_at), "dd/MM HH:mm") : "—"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
