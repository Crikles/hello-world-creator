import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Truck } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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

const statusOptions = [
  { value: "pendente", label: "Pendente" },
  { value: "em_transito", label: "Em Trânsito" },
  { value: "saiu_para_entrega", label: "Saiu para Entrega" },
  { value: "entregue", label: "Entregue" },
];

type ShipmentStatus = "pendente" | "em_transito" | "saiu_para_entrega" | "entregue";

export default function Envios() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    cliente_nome: "",
    cliente_email: "",
    produto: "",
    valor: "",
    codigo_rastreio: "",
  });

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

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("envios").insert({
        cliente_nome: form.cliente_nome,
        cliente_email: form.cliente_email,
        produto: form.produto,
        valor: parseFloat(form.valor) || 0,
        codigo_rastreio: form.codigo_rastreio || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["envios"] });
      setForm({ cliente_nome: "", cliente_email: "", produto: "", valor: "", codigo_rastreio: "" });
      setOpen(false);
      toast.success("Envio cadastrado com sucesso!");
    },
    onError: () => toast.error("Erro ao cadastrar envio."),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ShipmentStatus }) => {
      const { error } = await supabase.from("envios").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["envios"] });
      toast.success("Status atualizado!");
    },
  });

  const filteredEnvios = envios.filter((e) => {
    const matchSearch =
      e.cliente_nome.toLowerCase().includes(search.toLowerCase()) ||
      e.produto.toLowerCase().includes(search.toLowerCase()) ||
      (e.codigo_rastreio && e.codigo_rastreio.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = filterStatus === "todos" || e.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <AppLayout title="Envios">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-3 flex-1 w-full sm:w-auto">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, produto ou rastreio..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {statusOptions.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Novo Envio
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Envio</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome do Cliente</Label>
                    <Input value={form.cliente_nome} onChange={(e) => setForm({ ...form, cliente_nome: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email do Cliente</Label>
                    <Input type="email" value={form.cliente_email} onChange={(e) => setForm({ ...form, cliente_email: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Produto</Label>
                    <Input value={form.produto} onChange={(e) => setForm({ ...form, produto: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor (R$)</Label>
                    <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Código de Rastreio</Label>
                  <Input value={form.codigo_rastreio} onChange={(e) => setForm({ ...form, codigo_rastreio: e.target.value })} placeholder="Opcional" />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={!form.cliente_nome || !form.cliente_email || !form.produto || createMutation.isPending}
                >
                  {createMutation.isPending ? "Salvando..." : "Cadastrar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            {filteredEnvios.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Truck className="h-12 w-12 mb-3 opacity-30" />
                <p>Nenhum envio encontrado.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Rastreio</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEnvios.map((envio) => (
                    <TableRow key={envio.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{envio.cliente_nome}</div>
                          <div className="text-xs text-muted-foreground">{envio.cliente_email}</div>
                        </div>
                      </TableCell>
                      <TableCell>{envio.produto}</TableCell>
                      <TableCell>R$ {Number(envio.valor).toFixed(2)}</TableCell>
                      <TableCell className="font-mono text-xs">{envio.codigo_rastreio || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColors[envio.status]}>
                          {statusLabels[envio.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(envio.created_at), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={envio.status}
                          onValueChange={(val) => updateStatusMutation.mutate({ id: envio.id, status: val as ShipmentStatus })}
                        >
                          <SelectTrigger className="w-[140px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions.map((s) => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
