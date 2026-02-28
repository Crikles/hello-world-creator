import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Copy, Check, Plug, Zap, ZapOff } from "lucide-react";
import logoShopify from "@/assets/logo-shopify.png";
import { toast } from "@/hooks/use-toast";
import { useLoja } from "@/contexts/LojaContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import logoVega from "@/assets/logo-vega.png";
import logoZedy from "@/assets/logo-zedy.png";
import logoLuna from "@/assets/logo-luna.png";
import logoCorvex from "@/assets/logo-corvex.ico";

const WEBHOOK_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

const checkouts = [
  { id: "vega", name: "Vega Checkout", description: "Integração com Vega Checkout", logo: logoVega },
  { id: "zedy", name: "Zedy Checkout", description: "Integração com Zedy Checkout", logo: logoZedy },
  { id: "luna", name: "Luna Checkout", description: "Integração com Luna Checkout", logo: logoLuna },
  { id: "corvex", name: "Corvex Checkout", description: "Integração com Corvex Checkout", logo: logoCorvex },
];

function ShopifyCard({ loja }: { loja: any }) {
  const [open, setOpen] = useState(false);
  const [shopUrl, setShopUrl] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [copied, setCopied] = useState(false);

  const queryClient = useQueryClient();

  // Fetch existing config
  const { data: config, isLoading } = useQuery({
    queryKey: ["shopify-integration", loja?.id],
    queryFn: async () => {
      if (!loja?.id) return null;
      const { data, error } = await (supabase as any)
        .from("shopify_integrations")
        .select("*")
        .eq("loja_id", loja.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!loja?.id,
  });

  const isActive = !!config;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!loja?.id) throw new Error("Loja não selecionada");

      const cleanUrl = shopUrl.replace(/^https?:\/\//, '').replace(/\/$/, '').trim();
      if (!cleanUrl.includes("myshopify.com") && !cleanUrl.includes("admin.shopify.com")) {
        throw new Error("A URL da loja deve ser o domínio do Shopify (ex: sua-loja.myshopify.com)");
      }

      const payload = {
        loja_id: loja.id,
        shop_url: cleanUrl,
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
      };

      if (config) {
        const { error } = await (supabase as any)
          .from("shopify_integrations")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", (config as any).id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("shopify_integrations")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shopify-integration", loja?.id] });
      toast({ title: "Salvo!", description: "Credenciais salvas com sucesso." });
    },
    onError: (err: any) => {
      toast({ title: "Erro na integração", description: err.message, variant: "destructive" });
    }
  });

  const handleConnect = () => {
    if (!loja?.id) return;
    const cleanUrl = shopUrl.replace(/^https?:\/\//, '').replace(/\/$/, '').trim();
    const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopify-auth-callback`;
    const scopes = "read_orders,write_orders,read_assigned_fulfillment_orders,write_assigned_fulfillment_orders,read_third_party_fulfillment_orders,write_third_party_fulfillment_orders,read_merchant_managed_fulfillment_orders,write_merchant_managed_fulfillment_orders";
    const authUrl = `https://${cleanUrl}/admin/oauth/authorize?client_id=${clientId.trim()}&scope=${scopes}&redirect_uri=${redirectUri}&state=${loja.id}`;
    window.location.href = authUrl;
  };

  const handleOpen = () => {
    if (config) {
      setShopUrl((config as any).shop_url);
      setClientId((config as any).client_id);
      setClientSecret((config as any).client_secret);
    }
    setOpen(true);
  };

  const getWebhookUrl = () => {
    const slug = loja?.slug || "SUA_LOJA";
    return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopify-webhook?loja=${slug}`;
  };

  const copyWebhook = async () => {
    await navigator.clipboard.writeText(getWebhookUrl());
    setCopied(true);
    toast({ title: "URL copiada!", description: "Webhook salvo na área de transferência." });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div className="glass glow-border-hover rounded-xl p-5 group flex flex-col h-full bg-gradient-to-br from-[#95BF47]/5 to-transparent border-[#95BF47]/30 relative overflow-hidden animate-stagger-in">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#95BF47]/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

        <div className="flex items-center gap-3 mb-4 relative z-10">
          <div className="glass rounded-lg p-2 border border-[#95BF47]/40 shrink-0 bg-[#95BF47]/10 shadow-sm">
            <img src={logoShopify} alt="Shopify" className="h-8 w-8 object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-sm text-foreground">Shopify Custom App</h3>
              <Badge variant={isActive ? "default" : "secondary"} className={isActive ? "bg-[#95BF47]/20 text-[#95BF47] border-[#95BF47]/30 shadow-none" : ""}>
                {isActive && <span className="inline-block h-1.5 w-1.5 rounded-full bg-current mr-1 animate-pulse-dot" />}
                {isActive ? "Conectada" : "Inativa"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Sincronização de pedidos Shopify via API OAuth e Webhooks.</p>
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-border/30 relative z-10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Ativar integração</span>
            <Switch checked={isActive} disabled />
          </div>
          <Button
            variant="outline"
            className="w-full bg-[#95BF47]/5 text-[#95BF47] border-[#95BF47]/30 hover:bg-[#95BF47]/10 hover:text-[#95BF47] transition-colors"
            onClick={handleOpen}
          >
            {isActive ? "Detalhes e Webhook" : "Configurar Shopify"}
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <img src={logoShopify} alt="Shopify" className="h-5 w-5 object-contain" />
              Configurar Shopify
            </DialogTitle>
            <DialogDescription>
              Crie um app no <strong>Shopify Partner Dashboard</strong> e informe o Client ID e Client Secret. O token será renovado automaticamente através do OAuth.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 my-2">
            <div className="bg-muted/30 p-4 rounded-lg text-xs space-y-3 border border-border/50">
              <p className="font-semibold text-foreground flex items-center gap-2">
                <span>📄</span> Como criar o App no Shopify:
              </p>
              <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground ml-1">
                <li>Acesse <a href="https://dev.shopify.com/dashboard" target="_blank" rel="noreferrer" className="text-primary hover:underline">dev.shopify.com/dashboard</a> e faça login</li>
                <li>Clique em <strong>Create app</strong> (Criar app)</li>
                <li>Escolha <strong>"Start from Dev Dashboard"</strong></li>
                <li>Em <strong>Select scopes</strong>, adicione estritamente os escopos abaixo</li>
                <li>Vá até a aba "API Credentials", copie o <strong>Client ID</strong> e <strong>Client Secret</strong></li>
                <li>Preencha os campos abaixo e clique em Salvar e Conectar.</li>
              </ol>
              <div className="mt-4 pt-3 border-t border-border/40">
                <p className="font-semibold text-amber-500 mb-2">Escopos obrigatórios:</p>
                <div className="bg-background/80 p-3 rounded-md border border-border/50 font-mono text-[10.5px] text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  read_orders
                  <br />write_orders
                  <br />read_assigned_fulfillment_orders
                  <br />write_assigned_fulfillment_orders
                  <br />read_third_party_fulfillment_orders
                  <br />write_third_party_fulfillment_orders
                  <br />read_merchant_managed_fulfillment_orders
                  <br />write_merchant_managed_fulfillment_orders
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">URL da Loja</Label>
                <Input
                  placeholder="sua-loja.myshopify.com"
                  value={shopUrl}
                  onChange={e => setShopUrl(e.target.value)}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Client ID</Label>
                <Input
                  placeholder="Cole o Client ID do App..."
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  className="bg-background/50 font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Client Secret</Label>
                <Input
                  type="password"
                  placeholder="Cole o Secret do app no Partner Dashboard..."
                  value={clientSecret}
                  onChange={e => setClientSecret(e.target.value)}
                  className="bg-background/50 font-mono text-xs"
                />
              </div>
            </div>

            {isActive && (
              <div className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-lg mt-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">Webhook do Shopify</p>
                </div>
                <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
                  Configure este webhook no Shopify para receber pedidos em tempo real.<br />
                  Acesse no painel Shopify: <strong>Configurações &rarr; Notificações &rarr; Webhooks</strong>.<br />
                  Crie um webhook para o Evento: <strong>orders/paid</strong> com Formato <strong>JSON</strong>.
                </p>

                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">URL do Webhook</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={getWebhookUrl()}
                    className="h-9 text-xs font-mono bg-background/80 text-foreground"
                  />
                  <Button
                    variant="secondary"
                    className="h-9 shrink-0 gap-2 border-border/50"
                    onClick={copyWebhook}
                  >
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    <span className="hidden sm:inline">{copied ? "Copiado!" : "Copiar"}</span>
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-4">
            {isActive && (config as any)?.access_token && (
              <div className="flex-1 flex items-center">
                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 font-normal">
                  <Check className="h-3 w-3 mr-1" />
                  Token Ativo
                </Badge>
              </div>
            )}
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              variant="outline"
              onClick={() => saveMutation.mutate()}
              disabled={!shopUrl || !clientId || !clientSecret || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
            {isActive && !(config as any)?.access_token && (
              <Button
                className="bg-[#95BF47] hover:bg-[#7ea03a] text-white"
                onClick={handleConnect}
                disabled={!shopUrl || !clientId || !clientSecret}
              >
                Conectar OAuth
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Integracoes() {
  const [activeMap, setActiveMap] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { loja } = useLoja();

  const toggleCheckout = (id: string) => {
    setActiveMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getWebhookUrl = (id: string) => {
    const slug = loja?.slug || "SUA_LOJA";
    return `${WEBHOOK_BASE}/webhook-${id}?loja=${slug}`;
  };

  const copyWebhook = async (id: string) => {
    const url = getWebhookUrl(id);
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast({ title: "URL copiada!", description: "Webhook copiado para a área de transferência." });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const activeCount = Object.values(activeMap).filter(Boolean).length;
  const inactiveCount = checkouts.length - activeCount;

  return (
    <>
      {/* Hero Header */}
      <div className="glass glow-border rounded-xl p-5 mb-6 animate-stagger-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Plug className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Central de Integrações</h1>
              <p className="text-sm text-muted-foreground">
                Conecte seus checkouts para receber pedidos automaticamente via webhook.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 mb-6 animate-stagger-in" style={{ animationDelay: "0.05s" }}>
        <div className="glass glow-border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ativas</p>
            <p className="text-xl font-bold text-foreground">{activeCount}</p>
          </div>
        </div>
        <div className="glass rounded-xl p-4 flex items-center gap-3 border border-border/40">
          <div className="p-2 rounded-lg bg-muted">
            <ZapOff className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Inativas</p>
            <p className="text-xl font-bold text-foreground">{inactiveCount}</p>
          </div>
        </div>
      </div>

      {/* Checkout Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <ShopifyCard loja={loja} />
        {checkouts.map((checkout, idx) => {
          const isActive = !!activeMap[checkout.id];
          return (
            <div
              key={checkout.id}
              className="glass glow-border-hover rounded-xl p-5 animate-stagger-in group"
              style={{ animationDelay: `${0.1 + idx * 0.05}s` }}
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="glass rounded-lg p-1.5 border border-primary/20 shrink-0">
                  <img
                    src={checkout.logo}
                    alt={checkout.name}
                    className="h-10 w-10 rounded-md object-contain"
                    loading="eager"
                    decoding="sync"
                    fetchPriority="high"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-sm text-foreground">{checkout.name}</h3>
                    <Badge
                      variant={isActive ? "default" : "secondary"}
                      className={isActive ? "bg-primary/20 text-primary border-primary/30" : ""}
                    >
                      {isActive && (
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-current mr-1 animate-pulse-dot" />
                      )}
                      {isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{checkout.description}</p>
                </div>
              </div>

              {/* Webhook URL */}
              <div className="mb-3">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Webhook URL</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs glass border-primary/10 px-3 py-2.5 rounded-lg truncate text-foreground">
                    {getWebhookUrl(checkout.id)}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 glass border-primary/20 hover:border-primary/40 h-9 w-9"
                    onClick={() => copyWebhook(checkout.id)}
                  >
                    {copiedId === checkout.id ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-border/30">
                <span className="text-xs text-muted-foreground">Ativar integração</span>
                <Switch checked={isActive} onCheckedChange={() => toggleCheckout(checkout.id)} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
