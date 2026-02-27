import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Plus, Search, Truck, Trash2, Play, FastForward } from "lucide-react";
import { ImportarPlanilha } from "@/components/envios/ImportarPlanilha";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { NovoEnvioWizard } from "@/components/envios/NovoEnvioWizard";
import { triggerNextEmail, InsufficientBalanceError } from "@/lib/email-trigger";

function formatProduto(raw: string): string {
  try {
    const items = JSON.parse(raw);
    if (Array.isArray(items)) {
      return items.map((i: any) => `${i.nome} (x${i.quantidade})`).join(", ");
    }
  } catch {
    // not JSON, return as-is
  }
  return raw;
}

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  em_transito: "Em Trânsito",
  saiu_para_entrega: "Saiu p/ Entrega",
  entregue: "Entregue",
};

const statusColors: Record<string, string> = {
  pendente: "bg-primary/20 text-primary",
  em_transito: "bg-accent text-accent-foreground",
  saiu_para_entrega: "bg-primary/30 text-primary",
  entregue: "bg-primary/15 text-primary",
};

const statusOptions = [
  { value: "pendente", label: "Pendente" },
  { value: "em_transito", label: "Em Trânsito" },
  { value: "saiu_para_entrega", label: "Saiu para Entrega" },
  { value: "entregue", label: "Entregue" },
];

export default function Envios() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [autoEnvio, setAutoEnvio] = useState(false);
  const queryClient = useQueryClient();
  const { loja } = useLoja();

  // Fetch total events count for progress calculation
  const { data: totalEventos = 0 } = useQuery({
    queryKey: ["total-eventos", loja?.id],
    queryFn: async () => {
      if (!loja) return 0;
      const { data: config } = await supabase
        .from("postagem_config")
        .select("template_ativo_id")
        .eq("loja_id", loja.id)
        .maybeSingle();
      if (!config?.template_ativo_id) return 0;
      const { count } = await supabase
        .from("postagem_eventos")
        .select("*", { count: "exact", head: true })
        .eq("template_id", config.template_ativo_id);
      return count ?? 0;
    },
    enabled: !!loja,
  });

  const { data: envios = [] } = useQuery({
    queryKey: ["envios", loja?.id],
    queryFn: async () => {
      if (!loja) return [];
      const { data, error } = await supabase
        .from("envios")
        .select("*")
        .eq("loja_id", loja.id)
        .is("deleted_at" as any, null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!loja,
  });

  // Realtime listener for envios updates
  useEffect(() => {
    if (!loja?.id) return;
    const channel = supabase
      .channel(`envios-realtime-${loja.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "envios", filter: `loja_id=eq.${loja.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["envios", loja.id] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loja?.id, queryClient]);

  const advanceMutation = useMutation({
    mutationFn: async (envioId: string) => {
      if (!loja?.id) throw new Error("No loja");
      const result = await triggerNextEmail(envioId, loja.id);
      if (!result) throw new Error("Nenhum evento para avançar");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["envios"] });
      toast.success("Avançado!");
    },
    onError: (err: any) => {
      if (err instanceof InsufficientBalanceError) {
        toast.error("Saldo insuficiente de moedas. Adicione créditos para continuar.");
      } else {
        toast.error(err.message || "Erro ao avançar");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("envios").update({ deleted_at: new Date().toISOString() } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["envios"] });
      toast.success("Envio removido.");
    },
  });

  const batchAdvance = async (filterFn: (e: any) => boolean) => {
    const targets = envios.filter(filterFn);
    if (targets.length === 0) return toast.info("Nenhum envio encontrado.");
    let count = 0;
    for (const envio of targets) {
      if (!loja?.id) continue;
      const result = await triggerNextEmail(envio.id, loja.id);
      if (result) count++;
    }
    queryClient.invalidateQueries({ queryKey: ["envios"] });
    toast.success(`${count} envio(s) avançado(s)!`);
  };

  const filteredEnvios = envios.filter((e) => {
    const matchSearch =
      e.cliente_nome.toLowerCase().includes(search.toLowerCase()) ||
      e.produto.toLowerCase().includes(search.toLowerCase()) ||
      (e.codigo_rastreio && e.codigo_rastreio.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = filterStatus === "todos" || e.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const getProgress = (envio: any) => {
    if (totalEventos === 0) return 0;
    const ordem = envio.ultimo_evento_ordem ?? 0;
    return Math.round((ordem / totalEventos) * 100);
  };

  const getCurrentStep = (envio: any) => {
    return envio.ultimo_evento_ordem ?? 0;
  };

  const canAdvance = (envio: any) => {
    const ordem = envio.ultimo_evento_ordem ?? 0;
    return totalEventos > 0 && ordem < totalEventos;
  };

  const getDisplayStatus = (envio: any) => {
    return (envio as any).status_label || statusLabels[envio.status] || envio.status;
  };

  return (
    <>
      <h1 className="text-lg font-semibold text-foreground mb-4">Envios</h1>
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
              onClick={() => batchAdvance((e) => e.status === "pendente")}
            >
              <Play className="h-3.5 w-3.5 mr-1" /> Iniciar Pendentes
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => batchAdvance((e) => e.status !== "entregue")}
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
            {loja && <ImportarPlanilha lojaId={loja.id} />}
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
                      <TableCell>{formatProduto(envio.produto)}</TableCell>
                      <TableCell>R$ {Number(envio.valor).toFixed(2)}</TableCell>
                      <TableCell className="font-mono text-xs">{envio.codigo_rastreio || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColors[envio.status] || "bg-muted text-muted-foreground"}>
                          {getDisplayStatus(envio)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="w-28 space-y-1">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{getCurrentStep(envio)}/{totalEventos}</span>
                            <span>{getProgress(envio)}%</span>
                          </div>
                          <Progress value={getProgress(envio)} className="h-2" />
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(envio.created_at), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {canAdvance(envio) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Avançar próximo evento"
                              disabled={advanceMutation.isPending}
                              onClick={() => advanceMutation.mutate(envio.id)}
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
    </>
  );
}
