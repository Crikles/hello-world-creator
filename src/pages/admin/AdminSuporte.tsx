import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HeadphonesIcon, Save, MessageSquare, Send, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminSuporte() {
  const queryClient = useQueryClient();
  const [numero, setNumero] = useState("");
  const [uazapiToken, setUazapiToken] = useState("");
  const [uazapiInstance, setUazapiInstance] = useState("");
  const [testNumber, setTestNumber] = useState("");
  const [testing, setTesting] = useState(false);

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

  const { isLoading: loadingUazapi } = useQuery({
    queryKey: ["admin-uazapi-verificacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_config")
        .select("*")
        .in("key", ["verificacao_whatsapp_token", "verificacao_whatsapp_instance"]);
      if (error) throw error;
      data?.forEach((row: any) => {
        if (row.key === "verificacao_whatsapp_token") setUazapiToken(row.text_value || "");
        if (row.key === "verificacao_whatsapp_instance") setUazapiInstance(row.text_value || "");
      });
      return data;
    },
  });

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
    onError: (err: any) => {
      toast.error(err.message || "Erro ao atualizar.");
    },
  });

  const saveUazapiMutation = useMutation({
    mutationFn: async ({ token, instance }: { token: string; instance: string }) => {
      const { error: e1 } = await supabase
        .from("system_config")
        .update({ text_value: token, updated_at: new Date().toISOString() } as any)
        .eq("key", "verificacao_whatsapp_token");
      if (e1) throw e1;

      const { error: e2 } = await supabase
        .from("system_config")
        .update({ text_value: instance, updated_at: new Date().toISOString() } as any)
        .eq("key", "verificacao_whatsapp_instance");
      if (e2) throw e2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-uazapi-verificacao"] });
      toast.success("Configuração UAZAPI salva!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao salvar.");
    },
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

  const handleSaveUazapi = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uazapiToken.trim()) {
      toast.error("Token é obrigatório.");
      return;
    }
    saveUazapiMutation.mutate({ token: uazapiToken.trim(), instance: uazapiInstance.trim() });
  };

  const handleTestWhatsApp = async () => {
    if (!testNumber.trim()) {
      toast.error("Informe um número para teste.");
      return;
    }
    if (!uazapiToken.trim()) {
      toast.error("Salve o token antes de testar.");
      return;
    }
    setTesting(true);
    try {
      const cleaned = testNumber.replace(/\D/g, "");
      const phone = cleaned.startsWith("55") ? cleaned : "55" + cleaned;
      
      const res = await fetch(`https://rushsend.uazapi.com/send/text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${uazapiToken.trim()}`,
        },
        body: JSON.stringify({
          number: phone,
          text: "123456 - Mensagem de teste de verificação. Ignore.",
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

        {/* UAZAPI Verificação */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-green-500" />
              WhatsApp de Verificação (UAZAPI)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingUazapi ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-5">
                <form onSubmit={handleSaveUazapi} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Token da Instância UAZAPI</Label>
                    <Input
                      value={uazapiToken}
                      onChange={(e) => setUazapiToken(e.target.value)}
                      placeholder="Cole o token da instância aqui"
                      className="bg-muted/30 focus:bg-background font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Nome da Instância (opcional)</Label>
                    <Input
                      value={uazapiInstance}
                      onChange={(e) => setUazapiInstance(e.target.value)}
                      placeholder="Ex: Verificação Principal"
                      className="bg-muted/30 focus:bg-background"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    O código de verificação SMS será enviado também por WhatsApp durante o cadastro.
                  </p>
                  <Button type="submit" disabled={saveUazapiMutation.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    {saveUazapiMutation.isPending ? "Salvando..." : "Salvar Configuração"}
                  </Button>
                </form>

                {/* Test section */}
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
                      disabled={testing || !uazapiToken.trim()}
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
