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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Users, Store, Package, Coins, Contact, RefreshCw } from "lucide-react";
import { toast } from "sonner";

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

  // Dry run to get count
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

  const cards = [
    { title: "Usuários", value: stats?.usuarios ?? 0, icon: Users },
    { title: "Lojas", value: stats?.lojas ?? 0, icon: Store },
    { title: "Envios", value: stats?.envios ?? 0, icon: Package },
    { title: "Créditos em Circulação", value: stats?.creditos ?? 0, icon: Coins },
    { title: "Leads", value: stats?.leads ?? 0, icon: Contact },
  ];

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard Admin</h1>

        <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="gap-2" disabled={resendMutation.isPending}>
              <RefreshCw className={`h-4 w-4 ${resendMutation.isPending ? "animate-spin" : ""}`} />
              Reenviar Emails de Hoje
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reenviar todos os emails de hoje?</AlertDialogTitle>
              <AlertDialogDescription>
                {loadingCount
                  ? "Calculando..."
                  : `Serão reenviados ${emailCount ?? 0} emails com os links atualizados. Esta ação pode levar alguns minutos.`}
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
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <card.icon className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">{card.value.toLocaleString("pt-BR")}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
