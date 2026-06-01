import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Mail, AlertCircle, CheckCircle2, XCircle, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EmailLog {
  id: string;
  created_at: string;
  destinatario: string;
  assunto: string;
  status: string;
  custo: number;
  lojas: {
    nome: string;
  } | null;
}

export default function AdminEmail() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["admin-email-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("postagem_email_log")
        .select(`
          *,
          lojas (
            nome
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as EmailLog[];
    },
  });

  const stats = logs?.reduce(
    (acc, log) => {
      acc.total++;
      if (log.status === "sent" || log.status === "success") acc.sent++;
      if (log.status === "failed" || log.status === "error") acc.failed++;
      acc.cost += Number(log.custo) || 0;
      return acc;
    },
    { total: 0, sent: 0, failed: 0, cost: 0 }
  ) || { total: 0, sent: 0, failed: 0, cost: 0 };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gestão de Emails</h1>
            <p className="text-muted-foreground">
              Monitore o envio de emails transacionais do sistema (Resend).
            </p>
          </div>
          <div className="flex items-center gap-2 bg-muted/50 px-3 py-1 rounded-full text-sm">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-muted-foreground">API Configurada</span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Enviados</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                Emails processados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Entregues</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.sent}</div>
              <p className="text-xs text-muted-foreground">
                Com sucesso
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Falhas</CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.failed}</div>
              <p className="text-xs text-muted-foreground">
                Erros de envio
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Custo Estimado</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.cost.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Acumulado
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de Envios</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Loja</TableHead>
                    <TableHead>Destinatário</TableHead>
                    <TableHead>Assunto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum email enviado ainda.
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs?.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", {
                            locale: ptBR,
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.lojas?.nome || "Desconhecida"}</Badge>
                        </TableCell>
                        <TableCell>{log.destinatario}</TableCell>
                        <TableCell>{log.assunto}</TableCell>
                        <TableCell>
                          {(() => {
                            const s = log.status;
                            if (s === "delivered") return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white">Entregue</Badge>;
                            if (s === "opened") return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">Aberto</Badge>;
                            if (s === "clicked") return <Badge className="bg-indigo-500 hover:bg-indigo-600 text-white">Clicado</Badge>;
                            if (s === "sent" || s === "success") return <Badge className="bg-green-500 hover:bg-green-600 text-white">Enviado</Badge>;
                            if (s === "bounced") return <Badge className="bg-red-500 hover:bg-red-600 text-white">Bounce</Badge>;
                            if (s === "complained") return <Badge className="bg-orange-500 hover:bg-orange-600 text-white">Spam</Badge>;
                            if (s === "delivery_delayed") return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black">Atrasado</Badge>;
                            return <Badge variant="destructive">Falha</Badge>;
                          })()}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(log.custo).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
