import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DollarSign, Coins, CheckCircle, Clock, CalendarIcon, Webhook, Trash2, Plus } from "lucide-react";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
        .select("id, user_id, amount_cents, moedas, status, created_at, paid_at, transaction_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
      let profilesMap: Record<string, any> = {};
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, email, whatsapp")
          .in("id", userIds);
        (profs ?? []).forEach((p: any) => { profilesMap[p.id] = p; });
      }
      return rows.map((r) => ({ ...r, profiles: profilesMap[r.user_id] ?? null })) as PixPaymentRow[];
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

        {/* Date filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          {([["today", "Hoje"], ["7d", "7 dias"], ["30d", "30 dias"], ["all", "Todos"]] as const).map(([key, label]) => (
            <Button key={key} size="sm" variant={preset === key ? "default" : "outline"} onClick={() => applyPreset(key)}>
              {label}
            </Button>
          ))}

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "De"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d ? startOfDay(d) : undefined); setPreset("all"); }} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, "dd/MM/yyyy") : "Até"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d ? endOfDay(d) : undefined); setPreset("all"); }} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
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
        {/* Webhooks Section */}
        <WebhooksSection />
      </div>
    </AdminLayout>
  );
}

function WebhooksSection() {
  const queryClient = useQueryClient();
  const [newUrl, setNewUrl] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const { data: webhooks = [] } = useQuery({
    queryKey: ["admin-payment-webhooks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_payment_webhooks")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("admin_payment_webhooks")
        .insert({ url: newUrl.trim(), label: newLabel.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-payment-webhooks"] });
      setNewUrl("");
      setNewLabel("");
      toast.success("Webhook adicionado");
    },
    onError: () => toast.error("Erro ao adicionar webhook"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("admin_payment_webhooks")
        .update({ ativo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-payment-webhooks"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("admin_payment_webhooks")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-payment-webhooks"] });
      toast.success("Webhook removido");
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Webhook className="h-5 w-5" />
          Webhooks de Notificação
        </CardTitle>
        <p className="text-sm text-muted-foreground">Receba notificações externas quando uma recarga PIX for confirmada.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Label (opcional)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="sm:w-48"
          />
          <Input
            placeholder="https://..."
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="flex-1"
          />
          <Button
            size="sm"
            disabled={!newUrl.trim().startsWith("http") || addMutation.isPending}
            onClick={() => addMutation.mutate()}
          >
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </div>

        {/* List */}
        {webhooks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum webhook configurado.</p>
        ) : (
          <div className="space-y-2">
            {webhooks.map((wh) => (
              <div key={wh.id} className="flex items-center gap-3 rounded-md border border-border p-3">
                <Switch
                  checked={wh.ativo}
                  onCheckedChange={(checked) => toggleMutation.mutate({ id: wh.id, ativo: checked })}
                />
                <div className="flex-1 min-w-0">
                  {wh.label && <span className="text-sm font-medium text-foreground mr-2">{wh.label}</span>}
                  <span className="text-xs text-muted-foreground break-all">{wh.url}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(wh.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
