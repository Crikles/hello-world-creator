import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  HeadphonesIcon, Save, MessageSquare, Send, Loader2,
  QrCode, Wifi, WifiOff, Trash2, Power, Plug, Phone, RefreshCw
} from "lucide-react";
import { toast } from "sonner";

const SUPABASE_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-verification-whatsapp`;

async function callVerificationFn(action: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Não autenticado");

  const res = await fetch(SUPABASE_FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ action }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erro na requisição");
  return data;
}

export default function AdminSuporte() {
  const queryClient = useQueryClient();
  const [numero, setNumero] = useState("");
  const [testNumber, setTestNumber] = useState("");
  const [testing, setTesting] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [whatsTemplate, setWhatsTemplate] = useState("{{codigo}} - Use este código para confirmar seu cadastro. Válido por 10 min.");

  // ── WhatsApp Suporte number ──
  const { data: config, isLoading } = useQuery({
    queryKey: ["admin-whatsapp-suporte"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_config")
        .select("*")
        .eq("key", "whatsapp_suporte")
        .maybeSingle();
      if (error) throw error;
      if (data) setNumero(String(data.value));
      return data;
    },
  });

  // ── Verification instance config ──
  const { data: verConfig, isLoading: loadingVer } = useQuery({
    queryKey: ["admin-verificacao-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_config")
        .select("*")
        .in("key", [
          "verificacao_whatsapp_token",
          "verificacao_whatsapp_instance",
          "verificacao_whatsapp_status",
          "verificacao_whatsapp_phone",
          "verificacao_whatsapp_template",
        ]);
      if (error) throw error;
      const map: Record<string, string | null> = {};
      data?.forEach((row: any) => {
        map[row.key] = row.text_value;
      });
      if (map.verificacao_whatsapp_template) {
        setWhatsTemplate(map.verificacao_whatsapp_template);
      }
      return map;
    },
  });

  const instanceToken = verConfig?.verificacao_whatsapp_token || null;
  const instanceName = verConfig?.verificacao_whatsapp_instance || null;
  const instanceStatus = verConfig?.verificacao_whatsapp_status || "disconnected";
  const instancePhone = verConfig?.verificacao_whatsapp_phone || null;
  const hasInstance = !!instanceToken;
  const isConnected = instanceStatus === "connected" || instanceStatus === "open";

  // ── Polling for status while connecting ──
  const checkStatus = useCallback(async () => {
    try {
      const data = await callVerificationFn("status");
      if (data.status === "connected" || data.status === "open") {
        setPolling(false);
        setQrCode(null);
        setPairingCode(null);
        queryClient.invalidateQueries({ queryKey: ["admin-verificacao-config"] });
        toast.success("WhatsApp conectado com sucesso!");
      } else if (data.qrcode) {
        setQrCode(data.qrcode);
        setPairingCode(data.pairingCode || null);
      }
    } catch {
      // silent
    }
  }, [queryClient]);

  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(checkStatus, 4000);
    return () => clearInterval(interval);
  }, [polling, checkStatus]);

  // ── Mutations ──
  const updateMutation = useMutation({
    mutationFn: async (value: number) => {
      const { error } = await supabase
        .from("system_config")
        .update({ value, updated_at: new Date().toISOString() })
        .eq("key", "whatsapp_suporte");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-whatsapp-suporte"] });
      toast.success("Número de suporte atualizado!");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao atualizar."),
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async (template: string) => {
      const { error } = await supabase
        .from("system_config")
        .update({ text_value: template, updated_at: new Date().toISOString() } as any)
        .eq("key", "verificacao_whatsapp_template");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-verificacao-config"] });
      toast.success("Template salvo!");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao salvar template."),
  });

  const initMutation = useMutation({
    mutationFn: () => callVerificationFn("init"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-verificacao-config"] });
      toast.success("Instância criada! Agora conecte um número.");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao criar instância."),
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const data = await callVerificationFn("connect");
      setQrCode(data.qrcode || null);
      setPairingCode(data.pairingCode || null);
      setPolling(true);
      return data;
    },
    onError: (err: any) => toast.error(err.message || "Erro ao conectar."),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => callVerificationFn("disconnect"),
    onSuccess: () => {
      setQrCode(null);
      setPairingCode(null);
      setPolling(false);
      queryClient.invalidateQueries({ queryKey: ["admin-verificacao-config"] });
      toast.success("Instância desconectada.");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao desconectar."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => callVerificationFn("delete"),
    onSuccess: () => {
      setQrCode(null);
      setPairingCode(null);
      setPolling(false);
      queryClient.invalidateQueries({ queryKey: ["admin-verificacao-config"] });
      toast.success("Instância excluída.");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao excluir."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(numero.replace(/\D/g, ""));
    if (isNaN(val) || val <= 0) {
      toast.error("Número inválido.");
      return;
    }
    updateMutation.mutate(val);
  };

  const handleTestWhatsApp = async () => {
    if (!testNumber.trim()) {
      toast.error("Informe um número para teste.");
      return;
    }
    setTesting(true);
    try {
      const cleaned = testNumber.replace(/\D/g, "");
      const phone = cleaned.startsWith("55") ? cleaned : "55" + cleaned;

      const { data: tokenRow } = await supabase
        .from("system_config")
        .select("text_value")
        .eq("key", "verificacao_whatsapp_token")
        .maybeSingle();

      if (!tokenRow?.text_value) {
        toast.error("Token não configurado.");
        return;
      }

      const res = await fetch("https://rushsend.uazapi.com/send/text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          token: tokenRow.text_value,
        },
        body: JSON.stringify({
          number: phone,
          text: "123456 - Mensagem de teste de verificação Magnus. Ignore.",
        }),
      });

      if (res.ok) {
        toast.success("Mensagem de teste enviada com sucesso!");
      } else {
        const body = await res.text();
        toast.error(`Erro ao enviar: ${res.status} - ${body.slice(0, 100)}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro na conexão.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-foreground mb-6">Suporte</h1>

      <div className="space-y-6 max-w-lg">
        {/* WhatsApp Suporte */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <HeadphonesIcon className="h-4 w-4 text-primary" />
              WhatsApp de Suporte
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Número completo com DDI (ex: 5511999999999)
                  </Label>
                  <Input
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    placeholder="5511999999999"
                    className="bg-muted/30 focus:bg-background"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Este número será exibido na aba de Suporte de todos os usuários do painel.
                </p>
                <Button type="submit" disabled={updateMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {updateMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* WhatsApp Verificação (UAZAPI Instance) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-green-500" />
              WhatsApp de Verificação (UAZAPI)
              {hasInstance && (
                <Badge
                  variant={isConnected ? "default" : "secondary"}
                  className={`ml-auto text-[10px] ${isConnected ? "bg-green-600 hover:bg-green-700" : ""}`}
                >
                  {isConnected ? (
                    <><Wifi className="h-3 w-3 mr-1" /> Conectado</>
                  ) : instanceStatus === "connecting" ? (
                    <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Conectando</>
                  ) : (
                    <><WifiOff className="h-3 w-3 mr-1" /> Desconectado</>
                  )}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingVer ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !hasInstance ? (
              /* No instance — Create button */
              <div className="text-center py-6 space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Phone className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Nenhuma instância configurada</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Crie uma instância UAZAPI para enviar códigos de verificação por WhatsApp durante o cadastro.
                  </p>
                </div>
                <Button onClick={() => initMutation.mutate()} disabled={initMutation.isPending}>
                  {initMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plug className="h-4 w-4 mr-2" />
                  )}
                  Criar Instância
                </Button>
              </div>
            ) : (
              /* Instance exists */
              <div className="space-y-5">
                {/* Instance info */}
                {instanceName && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-mono">{instanceName}</span>
                    {instancePhone && (
                      <span className="ml-2">• <span className="font-medium text-foreground">{instancePhone}</span></span>
                    )}
                  </div>
                )}

                {/* QR Code display */}
                {(qrCode || (instanceStatus === "connecting" && !isConnected)) && (
                  <div className="border rounded-lg p-4 text-center space-y-3">
                    {qrCode ? (
                      <>
                        <p className="text-sm font-medium">Escaneie o QR Code no WhatsApp</p>
                        <div className="flex justify-center">
                          <img src={qrCode} alt="QR Code" className="w-48 h-48 rounded" />
                        </div>
                        {pairingCode && (
                          <p className="text-xs text-muted-foreground">
                            Código de pareamento: <span className="font-mono font-bold text-foreground">{pairingCode}</span>
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Aguardando conexão...
                        </p>
                      </>
                    ) : (
                      <div className="flex items-center justify-center gap-2 py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Gerando QR Code...</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Connected state */}
                {isConnected && (
                  <div className="border border-green-500/30 bg-green-500/5 rounded-lg p-4 text-center">
                    <Wifi className="h-6 w-6 text-green-500 mx-auto mb-2" />
                    <p className="text-sm font-medium text-green-600">WhatsApp conectado</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Códigos de verificação serão enviados por este número.
                    </p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                  {!isConnected && instanceStatus !== "connecting" && (
                    <Button
                      size="sm"
                      onClick={() => connectMutation.mutate()}
                      disabled={connectMutation.isPending}
                    >
                      {connectMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <QrCode className="h-4 w-4 mr-1" />
                      )}
                      Conectar
                    </Button>
                  )}

                  {isConnected && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => disconnectMutation.mutate()}
                      disabled={disconnectMutation.isPending}
                    >
                      {disconnectMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Power className="h-4 w-4 mr-1" />
                      )}
                      Desconectar
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const data = await callVerificationFn("status");
                        queryClient.invalidateQueries({ queryKey: ["admin-verificacao-config"] });
                        toast.success(`Status: ${data.status}`);
                      } catch (err: any) {
                        toast.error(err.message);
                      }
                    }}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Verificar Status
                  </Button>

                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (confirm("Tem certeza que deseja excluir a instância?")) {
                        deleteMutation.mutate();
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-1" />
                    )}
                    Excluir
                  </Button>
                </div>

                {/* Test send (only when connected) */}
                {isConnected && (
                  <div className="border-t pt-4 space-y-3">
                    <Label className="text-xs font-medium text-foreground">Testar Envio</Label>
                    <div className="flex gap-2">
                      <Input
                        value={testNumber}
                        onChange={(e) => setTestNumber(e.target.value)}
                        placeholder="5511999999999"
                        className="bg-muted/30 focus:bg-background flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleTestWhatsApp}
                        disabled={testing}
                      >
                        {testing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Envia uma mensagem de teste para validar a conexão.
                    </p>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  O código de verificação SMS será enviado também por WhatsApp durante o cadastro.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
