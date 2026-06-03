import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Cloud, Loader2, RefreshCw, CheckCircle2, XCircle, RotateCcw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function fmtBytes(n: number | null | undefined) {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${u[i]}`;
}

export default function AdminBackup() {
  const [running, setRunning] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [restoreFolder, setRestoreFolder] = useState("");

  const runs = useQuery({
    queryKey: ["backup-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("backup_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: running ? 3000 : 30000,
  });

  const state = useQuery({
    queryKey: ["backup-state"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("backup_state")
        .select("*")
        .order("table_name");
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: running ? 3000 : 60000,
  });

  const runBackup = async () => {
    setRunning(true);
    toast.info("Backup iniciado, isso pode levar alguns minutos...");
    try {
      const { data, error } = await supabase.functions.invoke("backup-to-drive", {
        body: {},
      });
      if (error) throw error;
      toast.success(
        `Backup concluído! ${data?.totalRows ?? 0} linhas, ${fmtBytes(data?.totalBytes)} → pasta ${data?.folder}`,
      );
      runs.refetch(); state.refetch();
    } catch (e) {
      toast.error("Erro no backup: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setRunning(false);
    }
  };

  const last = runs.data?.[0];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Cloud className="h-6 w-6" /> Backup Google Drive
            </h1>
            <p className="text-sm text-muted-foreground">
              Backup incremental diário (03:00 UTC) na pasta <strong>LovableCloud-Backup</strong> do Google Drive conectado.
              Apenas registros novos/atualizados são enviados a cada execução.
            </p>
          </div>
          <Button onClick={runBackup} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Rodar agora
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Última execução</CardTitle></CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">
                {last?.started_at ? format(new Date(last.started_at), "dd/MM HH:mm", { locale: ptBR }) : "—"}
              </div>
              {last?.status && (
                <Badge variant={last.status === "ok" ? "default" : last.status === "running" ? "secondary" : "destructive"} className="mt-1">
                  {last.status}
                </Badge>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Tabelas processadas</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{last?.tables_processed ?? 0}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Linhas enviadas</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{last?.total_rows?.toLocaleString("pt-BR") ?? 0}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Volume enviado</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{fmtBytes(last?.total_bytes)}</div></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Histórico de execuções</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Início</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Tabelas</TableHead>
                  <TableHead className="text-right">Linhas</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(runs.data ?? []).map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{format(new Date(r.started_at), "dd/MM/yy HH:mm:ss", { locale: ptBR })}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "ok" ? "default" : r.status === "running" ? "secondary" : "destructive"}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{r.tables_processed ?? 0}</TableCell>
                    <TableCell className="text-right">{(r.total_rows ?? 0).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right">{fmtBytes(r.total_bytes)}</TableCell>
                    <TableCell className="text-xs text-destructive max-w-md truncate">{r.error ?? ""}</TableCell>
                  </TableRow>
                ))}
                {runs.data?.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhuma execução ainda. Clique em "Rodar agora".</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Estado por tabela</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tabela</TableHead>
                  <TableHead>Último backup</TableHead>
                  <TableHead className="text-right">Linhas (última)</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(state.data ?? []).map((s: any) => (
                  <TableRow key={s.table_name}>
                    <TableCell className="font-mono text-xs">{s.table_name}</TableCell>
                    <TableCell>{s.last_backup_at ? format(new Date(s.last_backup_at), "dd/MM HH:mm", { locale: ptBR }) : "—"}</TableCell>
                    <TableCell className="text-right">{(s.last_rows_count ?? 0).toLocaleString("pt-BR")}</TableCell>
                    <TableCell>
                      {s.last_status === "ok" ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : s.last_status === "error" ? <XCircle className="h-4 w-4 text-destructive" /> : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
