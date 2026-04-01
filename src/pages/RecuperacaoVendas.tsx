import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Copy, Mail, MessageSquare, ShoppingCart, Clock, Gift, Eye, Download, RefreshCw } from "lucide-react";
import { format } from "date-fns";

const DEFAULT_EMAIL_BODY = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a1a1a;">Olá, {{nome_cliente}} 👋</h2>
  <p>Percebemos que você deixou algo importante no seu carrinho — e achamos que vale te avisar antes que você perca isso.</p>
  
  <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0;">
    <p style="margin: 0; font-weight: bold;">🛒 Resumo do seu pedido:</p>
    <p>{{lista_produtos}}</p>
    <p style="font-size: 18px; font-weight: bold;">💰 Valor: {{valor_total}}</p>
  </div>
  
  <p>Talvez algo tenha te interrompido… Pode ter sido dúvida, falta de tempo ou só aquele "depois eu vejo".</p>
  <p>Mas aqui vai um ponto importante 👇</p>
  
  <p>👉 O que você estava prestes a garantir não é só um produto. É uma forma de {{beneficio_principal}}.</p>
  
  <p>Com isso, você consegue:</p>
  <ul>
    <li>✔️ {{beneficio_1}}</li>
    <li>✔️ {{beneficio_2}}</li>
    <li>✔️ {{beneficio_3}}</li>
  </ul>
  
  {{#existe_cupom}}
  <div style="background: #fff3cd; border: 2px dashed #ffc107; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">
    <p style="font-weight: bold; margin: 0;">🎁 Tem um incentivo pra você voltar agora:</p>
    <p style="font-size: 24px; font-weight: bold; color: #d63384; margin: 8px 0;">{{codigo_cupom}}</p>
    <p style="margin: 0;">💸 {{descricao_cupom}}</p>
    <p style="font-size: 12px; color: #666; margin-top: 8px;">⏳ Esse cupom pode expirar a qualquer momento.</p>
  </div>
  {{/existe_cupom}}
  
  <p>Se ainda existe alguma dúvida, fique tranquilo: {{garantia}}</p>
  
  <div style="text-align: center; margin: 24px 0;">
    <a href="{{link_checkout}}" style="display: inline-block; background: #6366f1; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
      👉 Finalizar meu pedido
    </a>
  </div>
  
  <p style="font-size: 13px; color: #888;">P.S.: {{ps_reforco_urgencia}}</p>
</div>`;

export default function RecuperacaoVendas() {
  const { loja } = useLoja();
  const queryClient = useQueryClient();

  // Config state
  const [ativo, setAtivo] = useState(false);
  const [delayMinutos, setDelayMinutos] = useState(30);
  const [assuntoEmail, setAssuntoEmail] = useState("{{nome_cliente}}, você esqueceu algo 👀");
  const [corpoEmail, setCorpoEmail] = useState(DEFAULT_EMAIL_BODY);
  const [cupomAtivo, setCupomAtivo] = useState(false);
  const [codigoCupom, setCodigoCupom] = useState("");
  const [descricaoCupom, setDescricaoCupom] = useState("");
  const [beneficioPrincipal, setBeneficioPrincipal] = useState("");
  const [beneficio1, setBeneficio1] = useState("");
  const [beneficio2, setBeneficio2] = useState("");
  const [beneficio3, setBeneficio3] = useState("");
  const [garantia, setGarantia] = useState("");
  const [psReforco, setPsReforco] = useState("");
  const [enviarSms, setEnviarSms] = useState(false);
  const [smsTemplate, setSmsTemplate] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const webhookUrl = loja
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-recovery?token=${loja.webhook_token}`
    : "";

  // Fetch config
  const { data: config, isLoading: loadingConfig } = useQuery({
    queryKey: ["recovery-config", loja?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("recovery_config")
        .select("*")
        .eq("loja_id", loja!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!loja,
  });

  // Populate from DB
  useEffect(() => {
    if (config) {
      setAtivo(config.ativo);
      setDelayMinutos(config.delay_minutos);
      setAssuntoEmail(config.assunto_email);
      setCorpoEmail(config.corpo_email || DEFAULT_EMAIL_BODY);
      setCupomAtivo(config.cupom_ativo);
      setCodigoCupom(config.codigo_cupom || "");
      setDescricaoCupom(config.descricao_cupom || "");
      setBeneficioPrincipal(config.beneficio_principal || "");
      setBeneficio1(config.beneficio_1 || "");
      setBeneficio2(config.beneficio_2 || "");
      setBeneficio3(config.beneficio_3 || "");
      setGarantia(config.garantia || "");
      setPsReforco(config.ps_reforco_urgencia || "");
      setEnviarSms(config.enviar_sms);
      setSmsTemplate(config.sms_template || "");
    }
  }, [config]);

  // Save config
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        loja_id: loja!.id,
        ativo,
        delay_minutos: delayMinutos,
        assunto_email: assuntoEmail,
        corpo_email: corpoEmail,
        enviar_sms: enviarSms,
        sms_template: smsTemplate,
        cupom_ativo: cupomAtivo,
        codigo_cupom: codigoCupom,
        descricao_cupom: descricaoCupom,
        beneficio_principal: beneficioPrincipal,
        beneficio_1: beneficio1,
        beneficio_2: beneficio2,
        beneficio_3: beneficio3,
        garantia,
        ps_reforco_urgencia: psReforco,
      };

      if (config) {
        const { error } = await supabase
          .from("recovery_config")
          .update(payload)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("recovery_config")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Configuração salva!" });
      queryClient.invalidateQueries({ queryKey: ["recovery-config"] });
    },
    onError: () => {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    },
  });

  // Leads
  const { data: leads = [], isLoading: loadingLeads } = useQuery({
    queryKey: ["recovery-leads", loja?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("recovery_leads")
        .select("*")
        .eq("loja_id", loja!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      return data || [];
    },
    enabled: !!loja,
  });

  // Preview with sample data
  const previewVars: Record<string, string> = {
    nome_cliente: "Maria Silva",
    email_cliente: "maria@gmail.com",
    lista_produtos: "Kit Skincare Premium (x1) — R$ 197,00<br>Sérum Vitamina C (x1) — R$ 89,00",
    nome_produto_principal: "Kit Skincare Premium",
    valor_total: "R$ 286,00",
    link_checkout: "https://suacheckout.com/carrinho/abc123",
    beneficio_principal: beneficioPrincipal || "transformar sua rotina de cuidados",
    beneficio_1: beneficio1 || "Resultados visíveis em 7 dias",
    beneficio_2: beneficio2 || "Fórmula dermatologicamente testada",
    beneficio_3: beneficio3 || "Satisfação garantida",
    garantia: garantia || "7 dias de garantia incondicional",
    ps_reforco_urgencia: psReforco || "Esse link expira em 24h. Garanta agora!",
    existe_cupom: cupomAtivo ? "true" : "",
    codigo_cupom: codigoCupom || "VOLTE10",
    descricao_cupom: descricaoCupom || "10% OFF na sua compra",
    nome_loja: loja?.nome || "Minha Loja",
  };

  function renderPreview(template: string): string {
    let result = template;
    result = result.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_m, key, content) => {
      return previewVars[key]?.trim() ? content : "";
    });
    for (const [key, value] of Object.entries(previewVars)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }
    return result;
  }

  const statusColors: Record<string, string> = {
    pendente: "bg-yellow-500/10 text-yellow-600",
    email_enviado: "bg-blue-500/10 text-blue-600",
    sms_enviado: "bg-purple-500/10 text-purple-600",
    convertido: "bg-green-500/10 text-green-600",
    expirado: "bg-muted text-muted-foreground",
    sem_credito: "bg-red-500/10 text-red-600",
  };

  const pendingCount = leads.filter(l => l.status === "pendente").length;
  const sentCount = leads.filter(l => l.status === "email_enviado").length;

  if (!loja) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Recuperação de Vendas</h1>
        <p className="text-muted-foreground">Recupere carrinhos abandonados com emails personalizados</p>
      </div>

      {/* Webhook URL */}
      <Card className="glass glow-border">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-1">URL do Webhook — Vendas Pendentes</p>
              <code className="text-xs bg-muted px-2 py-1 rounded block truncate">{webhookUrl}</code>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(webhookUrl);
                toast({ title: "URL copiada!" });
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">⚙️ Configuração</TabsTrigger>
          <TabsTrigger value="leads">📋 Leads ({leads.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-6">
          {/* Toggle + Delay */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" /> Geral
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Ativar Recuperação de Vendas</Label>
                <Switch checked={ativo} onCheckedChange={setAtivo} />
              </div>
              <div>
                <Label>Delay antes do disparo (minutos)</Label>
                <Input
                  type="number"
                  value={delayMinutos}
                  onChange={e => setDelayMinutos(Number(e.target.value))}
                  className="mt-1 w-32"
                />
                <p className="text-xs text-muted-foreground mt-1">Tempo após o abandono para enviar o email</p>
              </div>
            </CardContent>
          </Card>

          {/* Email Template */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="h-5 w-5" /> Email de Recuperação
              </CardTitle>
              <CardDescription>
                Variáveis: {"{{nome_cliente}}"}, {"{{lista_produtos}}"}, {"{{valor_total}}"}, {"{{link_checkout}}"}, {"{{nome_produto_principal}}"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Assunto do Email</Label>
                <Input
                  value={assuntoEmail}
                  onChange={e => setAssuntoEmail(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Corpo do Email (HTML)</Label>
                <Textarea
                  value={corpoEmail}
                  onChange={e => setCorpoEmail(e.target.value)}
                  className="mt-1 min-h-[300px] font-mono text-xs"
                />
              </div>
              <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
                <Eye className="h-4 w-4 mr-2" />
                {showPreview ? "Ocultar Preview" : "Ver Preview"}
              </Button>
              {showPreview && (
                <Card className="border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Preview — Assunto: {renderPreview(assuntoEmail)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: renderPreview(corpoEmail) }}
                    />
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>

          {/* Benefícios */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">💎 Copy de Conversão</CardTitle>
              <CardDescription>
                Variáveis: {"{{beneficio_principal}}"}, {"{{beneficio_1}}"}, {"{{beneficio_2}}"}, {"{{beneficio_3}}"}, {"{{garantia}}"}, {"{{ps_reforco_urgencia}}"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Benefício Principal</Label>
                <Input value={beneficioPrincipal} onChange={e => setBeneficioPrincipal(e.target.value)} className="mt-1" placeholder="ex: transformar sua rotina de cuidados" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Benefício 1</Label>
                  <Input value={beneficio1} onChange={e => setBeneficio1(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Benefício 2</Label>
                  <Input value={beneficio2} onChange={e => setBeneficio2(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Benefício 3</Label>
                  <Input value={beneficio3} onChange={e => setBeneficio3(e.target.value)} className="mt-1" />
                </div>
              </div>
              <div>
                <Label>Garantia</Label>
                <Input value={garantia} onChange={e => setGarantia(e.target.value)} className="mt-1" placeholder="ex: 7 dias de garantia incondicional" />
              </div>
              <div>
                <Label>P.S. (Reforço de Urgência)</Label>
                <Input value={psReforco} onChange={e => setPsReforco(e.target.value)} className="mt-1" placeholder="ex: Esse link expira em 24h!" />
              </div>
            </CardContent>
          </Card>

          {/* Cupom */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Gift className="h-5 w-5" /> Cupom (Opcional)
              </CardTitle>
              <CardDescription>
                Condicionais: {"{{#existe_cupom}}...{{/existe_cupom}}"}, {"{{codigo_cupom}}"}, {"{{descricao_cupom}}"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Incluir Cupom no Email</Label>
                <Switch checked={cupomAtivo} onCheckedChange={setCupomAtivo} />
              </div>
              {cupomAtivo && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Código do Cupom</Label>
                    <Input value={codigoCupom} onChange={e => setCodigoCupom(e.target.value)} className="mt-1" placeholder="VOLTE10" />
                  </div>
                  <div>
                    <Label>Descrição do Cupom</Label>
                    <Input value={descricaoCupom} onChange={e => setDescricaoCupom(e.target.value)} className="mt-1" placeholder="10% OFF na sua compra" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* SMS */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" /> SMS (Opcional)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Enviar SMS de Recuperação</Label>
                <Switch checked={enviarSms} onCheckedChange={setEnviarSms} />
              </div>
              {enviarSms && (
                <div>
                  <Label>Template SMS</Label>
                  <Textarea
                    value={smsTemplate}
                    onChange={e => setSmsTemplate(e.target.value)}
                    className="mt-1 min-h-[80px]"
                    placeholder="Olá {{nome_cliente}}, seu carrinho com {{nome_produto_principal}} ainda está te esperando! Finalize: {{link_checkout}}"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
            {saveMutation.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
            Salvar Configuração
          </Button>
        </TabsContent>

        <TabsContent value="leads" className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="glass">
              <CardContent className="py-3 text-center">
                <p className="text-2xl font-bold">{leads.length}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </CardContent>
            </Card>
            <Card className="glass">
              <CardContent className="py-3 text-center">
                <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </CardContent>
            </Card>
            <Card className="glass">
              <CardContent className="py-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{sentCount}</p>
                <p className="text-xs text-muted-foreground">Emails Enviados</p>
              </CardContent>
            </Card>
            <Card className="glass">
              <CardContent className="py-3 text-center">
                <p className="text-2xl font-bold text-green-600">
                  {leads.filter(l => l.status === "convertido").length}
                </p>
                <p className="text-xs text-muted-foreground">Convertidos</p>
              </CardContent>
            </Card>
          </div>

          {/* Export */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const csv = [
                  ["Nome", "Email", "Telefone", "Produto", "Valor", "Status", "Data"].join(","),
                  ...leads.map(l => {
                    const prods = (l.products as { name: string }[] || []).map(p => p.name).join(" + ");
                    return [
                      `"${l.customer_name}"`,
                      l.customer_email,
                      l.customer_phone || "",
                      `"${prods}"`,
                      l.total_value,
                      l.status,
                      format(new Date(l.created_at), "dd/MM/yyyy HH:mm"),
                    ].join(",");
                  }),
                ].join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `recovery_leads_${format(new Date(), "yyyyMMdd")}.csv`;
                a.click();
              }}
            >
              <Download className="h-4 w-4 mr-2" /> Exportar CSV
            </Button>
          </div>

          {/* Leads Table */}
          {loadingLeads ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : leads.length === 0 ? (
            <Card className="glass">
              <CardContent className="py-8 text-center text-muted-foreground">
                <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>Nenhum lead capturado ainda.</p>
                <p className="text-xs mt-1">Configure o webhook no seu checkout para começar a capturar carrinhos abandonados.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {leads.map(lead => {
                const prods = (lead.products as { name: string; qty: number }[] || []);
                return (
                  <Card key={lead.id} className="glass">
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{lead.customer_name || "—"}</span>
                            <Badge variant="outline" className={statusColors[lead.status] || ""}>
                              {lead.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{lead.customer_email}</p>
                          {prods.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {prods.map(p => p.name).join(", ")}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-sm">
                            R$ {Number(lead.total_value || 0).toFixed(2).replace(".", ",")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(lead.created_at), "dd/MM HH:mm")}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
