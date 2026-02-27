import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Store, Package, Coins, Contact } from "lucide-react";

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [profiles, lojas, envios, creditos, leads] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("lojas").select("id", { count: "exact", head: true }),
        supabase.from("envios").select("id", { count: "exact", head: true }),
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

  const cards = [
    { title: "Usuários", value: stats?.usuarios ?? 0, icon: Users },
    { title: "Lojas", value: stats?.lojas ?? 0, icon: Store },
    { title: "Envios", value: stats?.envios ?? 0, icon: Package },
    { title: "Créditos em Circulação", value: stats?.creditos ?? 0, icon: Coins },
    { title: "Leads", value: stats?.leads ?? 0, icon: Contact },
  ];

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-foreground mb-6">Dashboard Admin</h1>
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
