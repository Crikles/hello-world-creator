import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DollarSign, Coins, CheckCircle, Clock, CalendarIcon } from "lucide-react";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

type PixPaymentRow = {
  id: string;
  user_id: string;
  amount_cents: number;
  moedas: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  transaction_id: string | null;
  profiles: { full_name: string | null; email: string | null; whatsapp: string | null } | null;
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PAID: { label: "Pago", variant: "default" },
  PENDING: { label: "Pendente", variant: "secondary" },
  CANCELLED: { label: "Cancelado", variant: "destructive" },
};

type DatePreset = "today" | "7d" | "30d" | "all";

export default function AdminPagamentos() {
  const [tab, setTab] = useState("all");
  const [preset, setPreset] = useState<DatePreset>("today");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(startOfDay(new Date()));
  const [dateTo, setDateTo] = useState<Date | undefined>(endOfDay(new Date()));

  const applyPreset = (p: DatePreset) => {
    setPreset(p);
    const now = new Date();
    if (p === "today") { setDateFrom(startOfDay(now)); setDateTo(endOfDay(now)); }
    else if (p === "7d") { setDateFrom(startOfDay(subDays(now, 6))); setDateTo(endOfDay(now)); }
    else if (p === "30d") { setDateFrom(startOfDay(subDays(now, 29))); setDateTo(endOfDay(now)); }
    else { setDateFrom(undefined); setDateTo(undefined); }
  };

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["admin-pix-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pix_payments")
        .select("id, user_id, amount_cents, moedas, status, created_at, paid_at, transaction_id, profiles(full_name, email, whatsapp)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PixPaymentRow[];
    },
  });

  const filteredByDate = useMemo(() => {
    return payments.filter((p) => {
      const d = new Date(p.created_at);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  }, [payments, dateFrom, dateTo]);

  const paid = filteredByDate.filter((p) => p.status === "PAID");
  const pending = filteredByDate.filter((p) => p.status === "PENDING");

  const totalReais = paid.reduce((s, p) => s + p.amount_cents, 0) / 100;
  const totalMoedas = paid.reduce((s, p) => s + Number(p.moedas), 0);

  const filtered = tab === "all" ? filteredByDate : filteredByDate.filter((p) => p.status === tab);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Pagamentos PIX</h1>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Receita Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {totalReais.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Moedas Adicionadas</CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{totalMoedas.toLocaleString("pt-BR")}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pagos</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{paid.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{pending.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs + Table */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="PAID">Pagos</TabsTrigger>
            <TabsTrigger value="PENDING">Pendentes</TabsTrigger>
            <TabsTrigger value="CANCELLED">Cancelados</TabsTrigger>
          </TabsList>

          <TabsContent value={tab}>
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">Nenhum pagamento encontrado.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead>WhatsApp</TableHead>
                        <TableHead className="text-right">Valor (R$)</TableHead>
                        <TableHead className="text-right">Moedas</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>ID Transação</TableHead>
                        <TableHead>Pago em</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((p) => {
                        const cfg = statusConfig[p.status] ?? { label: p.status, variant: "outline" as const };
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="whitespace-nowrap">
                              {format(new Date(p.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium text-foreground">{p.profiles?.full_name || "—"}</span>
                                <span className="text-xs text-muted-foreground">{p.profiles?.email || "—"}</span>
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">{p.profiles?.whatsapp || "—"}</TableCell>
                            <TableCell className="text-right font-medium">
                              {(p.amount_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </TableCell>
                            <TableCell className="text-right">{Number(p.moedas).toLocaleString("pt-BR")}</TableCell>
                            <TableCell>
                              <Badge variant={cfg.variant}>{cfg.label}</Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{p.transaction_id || "—"}</TableCell>
                            <TableCell className="whitespace-nowrap">
                              {p.paid_at ? format(new Date(p.paid_at), "dd/MM/yy HH:mm", { locale: ptBR }) : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
