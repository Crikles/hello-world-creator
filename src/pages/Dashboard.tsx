import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Clock, Truck, CheckCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  em_transito: "Em Trânsito",
  saiu_para_entrega: "Saiu p/ Entrega",
  entregue: "Entregue",
};

const statusColors: Record<string, string> = {
  pendente: "bg-yellow-100 text-yellow-800",
  em_transito: "bg-blue-100 text-blue-800",
  saiu_para_entrega: "bg-orange-100 text-orange-800",
  entregue: "bg-green-100 text-green-800",
};

export default function Dashboard() {
  const { data: envios = [] } = useQuery({
    queryKey: ["envios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("envios")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const total = envios.length;
  const pendentes = envios.filter((e) => e.status === "pendente").length;
  const emTransito = envios.filter((e) => e.status === "em_transito" || e.status === "saiu_para_entrega").length;
  const entregues = envios.filter((e) => e.status === "entregue").length;

  const recentEnvios = envios.slice(0, 5);

  const cards = [
    { title: "Total de Pedidos", value: total, icon: Package, color: "text-primary" },
    { title: "Pendentes", value: pendentes, icon: Clock, color: "text-yellow-600" },
    { title: "Em Trânsito", value: emTransito, icon: Truck, color: "text-blue-600" },
    { title: "Entregues", value: entregues, icon: CheckCircle, color: "text-green-600" },
  ];

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{card.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Envios Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {recentEnvios.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum envio cadastrado ainda.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Rastreio</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentEnvios.map((envio) => (
                    <TableRow key={envio.id}>
                      <TableCell className="font-medium">{envio.cliente_nome}</TableCell>
                      <TableCell>{envio.produto}</TableCell>
                      <TableCell className="font-mono text-xs">{envio.codigo_rastreio || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColors[envio.status]}>
                          {statusLabels[envio.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(envio.created_at), "dd/MM/yyyy")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
