import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Plus, Search, Truck, Eye, Trash2, Play, FastForward } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { NovoEnvioWizard } from "@/components/envios/NovoEnvioWizard";

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

const statusProgress: Record<string, number> = {
  pendente: 25,
  em_transito: 50,
  saiu_para_entrega: 75,
  entregue: 100,
};

const statusOptions = [
  { value: "pendente", label: "Pendente" },
  { value: "em_transito", label: "Em Trânsito" },
  { value: "saiu_para_entrega", label: "Saiu para Entrega" },
  { value: "entregue", label: "Entregue" },
];

type ShipmentStatus = "pendente" | "em_transito" | "saiu_para_entrega" | "entregue";

const nextStatusMap: Record<string, ShipmentStatus> = {
  pendente: "em_transito",
  em_transito: "saiu_para_entrega",
  saiu_para_entrega: "entregue",
};

export default function Envios() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [autoEnvio, setAutoEnvio] = useState(false);
  const queryClient = useQueryClient();

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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("envios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["envios"] });
      toast.success("Envio removido.");
    },
  });

  const batchUpdate = async (fromStatus: ShipmentStatus, toStatus: ShipmentStatus) => {
    const ids = envios.filter((e) => e.status === fromStatus).map((e) => e.id);
    if (ids.length === 0) return toast.info("Nenhum envio encontrado.");
    const { error } = await supabase.from("envios").update({ status: toStatus }).in("id", ids);
    if (error) return toast.error("Erro ao atualizar.");
    queryClient.invalidateQueries({ queryKey: ["envios"] });
    toast.success(`${ids.length} envio(s) atualizados!`);
  };

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
        <p className="text-sm text-muted-foreground -mt-2">
          Gerencie todos os pedidos enviados e códigos de rastreio.
        </p>

        {/* Action bar */}
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Switch checked={autoEnvio} onCheckedChange={setAutoEnvio} />
              <span className="text-sm text-muted-foreground">Envio Automático</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => batchUpdate("pendente", "em_transito")}
            >
              <Play className="h-3.5 w-3.5 mr-1" /> Iniciar Pendentes
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                batchUpdate("em_transito", "saiu_para_entrega");
                batchUpdate("saiu_para_entrega", "entregue");
              }}
            >
              <FastForward className="h-3.5 w-3.5 mr-1" /> Avançar Todos
            </Button>
          </div>

          <div className="flex gap-3 items-center w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {statusOptions.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setWizardOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Novo Envio
            </Button>
          </div>
        </div>

        {/* Table */}
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
                    <TableHead>Progresso</TableHead>
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
                      <TableCell>
                        <div className="w-24">
                          <Progress value={statusProgress[envio.status]} className="h-2" />
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(envio.created_at), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {nextStatusMap[envio.status] && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Avançar status"
                              onClick={() =>
                                updateStatusMutation.mutate({
                                  id: envio.id,
                                  status: nextStatusMap[envio.status],
                                })
                              }
                            >
                              <FastForward className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Remover"
                            onClick={() => deleteMutation.mutate(envio.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <NovoEnvioWizard open={wizardOpen} onOpenChange={setWizardOpen} />
      </div>
    </AppLayout>
  );
}
