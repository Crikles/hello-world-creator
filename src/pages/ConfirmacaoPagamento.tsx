import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLoja } from "@/contexts/LojaContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Settings, History, BookOpen, Mail, MessageSquare, Loader2, CheckCircle2, XCircle, Coins } from "lucide-react";
import { format } from "date-fns";

export default function ConfirmacaoPagamento() {
  const { user } = useAuth();
  const { loja } = useLoja();
  const queryClient = useQueryClient();

  // Config query
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["confirmacao-config", loja?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("confirmacao_pagamento_config")
        .select("*")
        .eq("loja_id", loja!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!loja,
  });

  // Costs query
  const { data: custos } = useQuery({
    queryKey: ["confirmacao-custos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_config")
        .select("key, value")
        .in("key", ["custo_confirmacao_email", "custo_confirmacao_sms"]);
      const map: Record<string, number> = {};
      (data || []).forEach((c) => { map[c.key] = c.value; });
      return map;
    },
  });

  // Log query
  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ["confirmacao-log", loja?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("confirmacao_pagamento_log")
        .select("*")
        .eq("loja_id", loja!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      return data || [];
    },
    enabled: !!loja,
  });

  // Local state
  const [ativo, setAtivo] = useState(false);
  const [enviarEmail, setEnviarEmail] = useState(true);
  const [enviarSms, setEnviarSms] = useState(true);
  const [assuntoEmail, setAssuntoEmail] = useState("Pagamento Confirmado! ✅ Seu pedido {{produto}} foi aprovado");
  const [corpoEmail, setCorpoEmail] = useState("");
  const [smsTemplate, setSmsTemplate] = useState("Ola {{nome}}! Seu pagamento de R${{valor}} foi confirmado. Obrigado pela compra!");

  useEffect(() => {
    if (config) {
      setAtivo(config.ativo);
      setEnviarEmail(config.enviar_email);
      setEnviarSms(config.enviar_sms);
      setAssuntoEmail(config.assunto_email);
      setCorpoEmail(config.corpo_email);
      setSmsTemplate(config.sms_template);
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        loja_id: loja!.id,
        ativo,
        enviar_email: enviarEmail,
        enviar_sms: enviarSms,
        assunto_email: assuntoEmail,
        corpo_email: corpoEmail,
        sms_template: smsTemplate,
      };

      if (config) {
        await supabase
          .from("confirmacao_pagamento_config")
          .update(payload)
          .eq("id", config.id);
      } else {
        await supabase
          .from("confirmacao_pagamento_config")
          .insert(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["confirmacao-config", loja?.id] });
      toast({ title: "Configuração salva com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    },
  });

  const custoEmail = custos?.custo_confirmacao_email ?? 0.50;
  const custoSms = custos?.custo_confirmacao_sms ?? 0.12;

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Confirmação de Pagamento</h1>
        <p className="text-muted-foreground mt-1">
          Envie emails e SMS automáticos quando um pagamento é confirmado
        </p>
      </div>

      <Tabs defaultValue="config" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="h-4 w-4" /> Configuração
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-2">
            <History className="h-4 w-4" /> Histórico
          </TabsTrigger>
          <TabsTrigger value="tutorial" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Tutorial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Status da Funcionalidade</span>
                <div className="flex items-center gap-2">
                  <Label htmlFor="ativo-switch" className="text-sm text-muted-foreground">
                    {ativo ? "Ativo" : "Desativado"}
                  </Label>
                  <Switch id="ativo-switch" checked={ativo} onCheckedChange={setAtivo} />
                </div>
              </CardTitle>
              <CardDescription>
                Quando ativo, cada pedido pago via webhook envia automaticamente um email e/ou SMS de confirmação
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Mail className="h-5 w-5 text-primary" />
                  Email de Confirmação
                  <Badge variant="secondary" className="ml-auto">
                    <Coins className="h-3 w-3 mr-1" />
                    {custoEmail.toFixed(2)} moedas
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Switch checked={enviarEmail} onCheckedChange={setEnviarEmail} />
                  <Label>Enviar email de confirmação</Label>
                </div>
                {enviarEmail && (
                  <>
                    <div>
                      <Label>Assunto do Email</Label>
                      <Input
                        value={assuntoEmail}
                        onChange={(e) => setAssuntoEmail(e.target.value)}
                        placeholder="Pagamento Confirmado! ✅"
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Variáveis: {"{{nome}}"}, {"{{produto}}"}, {"{{valor}}"}, {"{{empresa}}"}
                      </p>
                    </div>
                    <div>
                      <Label>Corpo do Email (HTML)</Label>
                      <Textarea
                        value={corpoEmail}
                        onChange={(e) => setCorpoEmail(e.target.value)}
                        placeholder="Deixe vazio para usar o template padrão bonito"
                        className="mt-1 min-h-[120px] font-mono text-xs"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Deixe vazio para usar o template padrão com dados da empresa
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  SMS de Confirmação
                  <Badge variant="secondary" className="ml-auto">
                    <Coins className="h-3 w-3 mr-1" />
                    {custoSms.toFixed(2)} moedas
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Switch checked={enviarSms} onCheckedChange={setEnviarSms} />
                  <Label>Enviar SMS de confirmação</Label>
                </div>
                {enviarSms && (
                  <div>
                    <Label>Template do SMS</Label>
                    <Textarea
                      value={smsTemplate}
                      onChange={(e) => setSmsTemplate(e.target.value)}
                      placeholder="Mensagem do SMS..."
                      className="mt-1 min-h-[80px]"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Variáveis: {"{{nome}}"}, {"{{produto}}"}, {"{{valor}}"}, {"{{empresa}}"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="w-full md:w-auto"
          >
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Configuração
          </Button>
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Confirmações</CardTitle>
              <CardDescription>Últimas 100 notificações enviadas</CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !logs?.length ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma confirmação enviada ainda
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Destinatário</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Custo</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log: any) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            {log.tipo === "email" ? (
                              <Badge variant="outline" className="gap-1">
                                <Mail className="h-3 w-3" /> Email
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1">
                                <MessageSquare className="h-3 w-3" /> SMS
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{log.destinatario}</TableCell>
                          <TableCell>
                            {log.status === "sent" ? (
                              <Badge className="bg-green-500/10 text-green-600 gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Enviado
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="gap-1">
                                <XCircle className="h-3 w-3" /> Falhou
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{Number(log.custo).toFixed(2)}</TableCell>
                          <TableCell className="text-xs">
                            {format(new Date(log.created_at), "dd/MM/yyyy HH:mm")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tutorial" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Como funciona?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">1. Ative a funcionalidade</h3>
                <p>Vá na aba Configuração e ative o switch principal. Escolha se deseja enviar email, SMS ou ambos.</p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">2. Personalize os templates</h3>
                <p>
                  Customize o assunto e corpo do email, e o template do SMS. Use variáveis como{" "}
                  <code className="bg-muted px-1 rounded">{"{{nome}}"}</code>,{" "}
                  <code className="bg-muted px-1 rounded">{"{{produto}}"}</code>,{" "}
                  <code className="bg-muted px-1 rounded">{"{{valor}}"}</code>,{" "}
                  <code className="bg-muted px-1 rounded">{"{{empresa}}"}</code>.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">3. Automático!</h3>
                <p>
                  Quando um pedido é pago via webhook (qualquer checkout integrado), o sistema
                  automaticamente envia a confirmação para o cliente.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">4. Preencha os dados da empresa</h3>
                <p>
                  Para que o email fique personalizado com a sua marca, preencha os dados
                  da empresa na página <strong>Empresa</strong> (logo, nome fantasia, etc).
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Coins className="h-4 w-4 text-primary" /> Custos
                </h3>
                <p>• Email de confirmação: <strong>{custoEmail.toFixed(2)} moedas</strong> por envio</p>
                <p>• SMS de confirmação: <strong>{custoSms.toFixed(2)} moedas</strong> por envio</p>
                <p className="text-xs">Os créditos são debitados automaticamente da sua carteira.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
