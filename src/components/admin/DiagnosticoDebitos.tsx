import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Zap, Coins, Filter, Play } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DiagRow {
  loja_id: string;
  loja_nome: string;
  user_id: string;
  user_email: string | null;
  user_nome: string | null;
  saldo: number;
  motivo: "auto_envio_off" | "saldo_insuficiente" | "filtro_metodo" | "outro" | null;
  envios_travados: number;
  pedidos_descartados: number;
  ultima_atividade: string | null;
  auto_envio: boolean | null;
  filtro_metodo: string | null;
  custo_estimado: number;
}

const motivoLabels: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  auto_envio_off: { label: "Envio automático desligado", color: "bg-amber-500/15 text-amber-600 border-amber-500/30", icon: <Zap className="h-3 w-3" /> },
  saldo_insuficiente: { label: "Saldo insuficiente", color: "bg-red-500/15 text-red-600 border-red-500/30", icon: <Coins className="h-3 w-3" /> },
  filtro_metodo: { label: "Filtro de método bloqueando", color: "bg-blue-500/15 text-blue-600 border-blue-500/30", icon: <Filter className="h-3 w-3" /> },
  outro: { label: "Outro / verificar", color: "bg-muted text-muted-foreground", icon: <AlertTriangle className="h-3 w-3" /> },
};

export function DiagnosticoDebitos() {
  const queryClient = useQueryClient();

  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-debit-diagnostics"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_debit_diagnostics");
      if (error) throw error;
      return (data || []) as DiagRow[];
    },
    refetchInterval: 30_000,
  });

  const enableAutoEnvio = useMutation({
    mutationFn: async (lojaId: string) => {
      const { error } = await supabase
        .from("postagem_config")
        .update({ auto_envio: true })
        .eq("loja_id", lojaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Envio automático ativado!");
      queryClient.invalidateQueries({ queryKey: ["admin-debit-diagnostics"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const fixFilter = useMutation({
    mutationFn: async (lojaId: string) => {
      const { error } = await supabase
        .from("checkout_integrations")
        .update({ filtro_metodo: "todos" })
        .eq("loja_id", lojaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Filtro de método alterado para 'todos'!");
      queryClient.invalidateQueries({ queryKey: ["admin-debit-diagnostics"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const triggerCron = useMutation({
    mutationFn: async (lojaId: string) => {
      const { error } = await supabase.functions.invoke("advance-shipments", {
        body: { loja_id: lojaId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Processamento disparado! Os envios serão tentados agora.");
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["admin-debit-diagnostics"] }), 3000);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const totalTravados = data.reduce((s, r) => s + Number(r.envios_travados || 0), 0);
  const totalDescartados = data.reduce((s, r) => s + Number(r.pedidos_descartados || 0), 0);

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Diagnóstico de Débitos {data.length > 0 && (
            <Badge variant="outline" className="ml-2">{data.length} loja(s) com bloqueio</Badge>
          )}
        </CardTitle>
        {(totalTravados > 0 || totalDescartados > 0) && (
          <p className="text-xs text-muted-foreground">
            {totalTravados} envio(s) travado(s) · {totalDescartados} pedido(s) pago(s) descartado(s) por filtro
          </p>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">✅ Nenhum bloqueio de cobrança detectado nas últimas 72h.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loja / Usuário</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Travados</TableHead>
                  <TableHead className="text-right">Descartados</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Último envio</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((r) => {
                  const m = motivoLabels[r.motivo || "outro"];
                  return (
                    <TableRow key={r.loja_id}>
                      <TableCell>
                        <div className="font-medium text-sm">{r.loja_nome}</div>
                        <div className="text-xs text-muted-foreground">{r.user_email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`gap-1 ${m.color}`}>
                          {m.icon} {m.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.envios_travados}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.pedidos_descartados}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className={r.saldo < r.custo_estimado ? "text-red-600 font-semibold" : ""}>
                          {Number(r.saldo).toFixed(2)}
                        </span>
                        {r.custo_estimado > 0 && (
                          <div className="text-[10px] text-muted-foreground">precisa {r.custo_estimado.toFixed(2)}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.ultima_atividade ? formatDistanceToNow(new Date(r.ultima_atividade), { addSuffix: true, locale: ptBR }) : "—"}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        {r.motivo === "auto_envio_off" && (
                          <Button size="sm" variant="outline" onClick={() => enableAutoEnvio.mutate(r.loja_id)} disabled={enableAutoEnvio.isPending}>
                            Ativar auto
                          </Button>
                        )}
                        {r.motivo === "filtro_metodo" && (
                          <Button size="sm" variant="outline" onClick={() => fixFilter.mutate(r.loja_id)} disabled={fixFilter.isPending}>
                            Filtro = todos
                          </Button>
                        )}
                        {r.envios_travados > 0 && (
                          <Button size="sm" variant="ghost" onClick={() => triggerCron.mutate(r.loja_id)} disabled={triggerCron.isPending} title="Disparar avanço agora">
                            <Play className="h-3 w-3" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
