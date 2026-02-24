import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Coins } from "lucide-react";
import { format } from "date-fns";

export default function AdminCreditos() {
  const { data: transacoes = [], isLoading } = useQuery({
    queryKey: ["admin-creditos-transacoes"],
    queryFn: async () => {
      const [transRes, profilesRes] = await Promise.all([
        supabase.from("creditos_transacoes").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name, email"),
      ]);
      const profiles = profilesRes.data || [];
      return (transRes.data || []).map((t) => {
        const profile = profiles.find((p) => p.id === t.user_id);
        const admin = t.admin_id ? profiles.find((p) => p.id === t.admin_id) : null;
        return {
          ...t,
          user_name: profile?.full_name || profile?.email || t.user_id,
          admin_name: admin ? admin.full_name || admin.email : null,
        };
      });
    },
  });

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-foreground mb-6">Histórico de Créditos</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Todas as Transações</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : transacoes.length === 0 ? (
            <div className="text-center py-8">
              <Coins className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma transação registrada.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Admin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transacoes.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{format(new Date(t.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell className="font-medium">{t.user_name}</TableCell>
                    <TableCell>
                      <Badge variant={t.tipo === "adicao" ? "default" : "destructive"} className="text-xs">
                        {t.tipo === "adicao" ? "Adição" : "Consumo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={t.tipo === "adicao" ? "text-green-400" : "text-destructive"}>
                        {t.tipo === "adicao" ? "+" : "-"}{t.quantidade}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{t.descricao || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{t.admin_name || "—"}</TableCell>
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
