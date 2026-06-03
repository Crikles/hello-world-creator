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

  const restoreRuns = useQuery({
    queryKey: ["restore-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restore_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: restoring ? 3000 : 60000,
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

  const runRestore = async () => {
    if (confirmText !== "RESTAURAR") {
      toast.error('Digite exatamente RESTAURAR para confirmar.');
      return;
    }
    setRestoring(true);
    setRestoreOpen(false);
    toast.info("Restauração iniciada, isso pode levar vários minutos...");
    try {
      const { data, error } = await supabase.functions.invoke("restore-from-drive", {
        body: {
          confirm: "RESTAURAR",
          folder: restoreFolder.trim() || undefined,
        },
      });
      if (error) throw error;
      toast.success(
        `Restauração concluída! ${data?.totalRows ?? 0} linhas em ${data?.tablesProcessed ?? 0} tabelas.`,
      );
      setConfirmText("");
      setRestoreFolder("");
      restoreRuns.refetch();
    } catch (e) {
      toast.error("Erro na restauração: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setRestoring(false);
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
          <div className="flex gap-2">
            <Button onClick={runBackup} disabled={running || restoring}>
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Rodar backup agora
            </Button>
            <Dialog open={restoreOpen} onOpenChange={setRestoreOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" disabled={running || restoring}>
                  {restoring ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                  Restaurar do Drive
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" /> Restauração completa
                  </DialogTitle>
                  <DialogDescription>
                    Esta ação vai ler todos os backups do Google Drive e sobrescrever os
                    registros existentes no banco (upsert por id). Use somente em caso de
                    perda de dados ou em um projeto novo/vazio.
                  </DialogDescription>
                </DialogHeader>

                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>O que NÃO é restaurado</AlertTitle>
                  <AlertDescription className="text-xs">
                    Chaves do Resend, Cyberpay, Integrax, VAPID, UAZAPI, etc. são <strong>variáveis
                    de ambiente</strong> da plataforma — não ficam no Drive. Após restaurar, reconfigure
                    esses segredos em Admin → Secrets. Tudo o que está nas tabelas (contas, envios,
                    pedidos, templates, integrações de checkout/Shopify com suas api_keys, créditos,
                    lojas, configurações, etc.) <strong>é restaurado</strong>.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label>Pasta específica (opcional, formato AAAA-MM-DD)</Label>
                  <Input
                    placeholder="Em branco = consolida todas as pastas (versão mais recente vence)"
                    value={restoreFolder}
                    onChange={(e) => setRestoreFolder(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Digite <strong>RESTAURAR</strong> para confirmar</Label>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="RESTAURAR"
                  />
                </div>

                <DialogFooter>
                  <Button variant="ghost" onClick={() => setRestoreOpen(false)}>Cancelar</Button>
                  <Button
                    variant="destructive"
                    disabled={confirmText !== "RESTAURAR"}
                    onClick={runRestore}
                  >
                    Executar restauração
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" /> Histórico de restaurações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Início</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pasta</TableHead>
                  <TableHead className="text-right">Tabelas</TableHead>
                  <TableHead className="text-right">Linhas</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(restoreRuns.data ?? []).map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{format(new Date(r.started_at), "dd/MM/yy HH:mm:ss", { locale: ptBR })}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "ok" ? "default" : r.status === "running" ? "secondary" : "destructive"}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.source_folder ?? "—"}</TableCell>
                    <TableCell className="text-right">{r.tables_processed ?? 0}</TableCell>
                    <TableCell className="text-right">{(r.total_rows ?? 0).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-xs text-destructive max-w-md truncate">{r.error ?? ""}</TableCell>
                  </TableRow>
                ))}
                {restoreRuns.data?.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhuma restauração executada.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
