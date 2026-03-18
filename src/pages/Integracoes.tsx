import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Copy, Check, Plug, Zap, ZapOff, Code2, ArrowRight } from "lucide-react";
import logoShopify from "@/assets/logo-shopify.png";
import { toast } from "@/hooks/use-toast";
import { useLoja } from "@/contexts/LojaContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import logoVega from "@/assets/logo-vega.png";
import logoZedy from "@/assets/logo-zedy.png";
import logoLuna from "@/assets/logo-luna.png";
import logoCorvex from "@/assets/logo-corvex.ico";
import logoAdoorei from "@/assets/logo-adoorei.png";

const WEBHOOK_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

const checkouts = [
  { id: "shopify", name: "Shopify Checkout", description: "Integração com Shopify Checkout", logo: logoShopify, webhookFn: "shopify-webhook" },
  { id: "vega", name: "Vega Checkout", description: "Integração com Vega Checkout", logo: logoVega, webhookFn: "webhook-vega" },
  { id: "zedy", name: "Zedy Checkout", description: "Integração com Zedy Checkout", logo: logoZedy, webhookFn: "webhook-zedy" },
  { id: "luna", name: "Luna Checkout", description: "Integração com Luna Checkout", logo: logoLuna, webhookFn: "webhook-luna" },
  { id: "corvex", name: "Corvex Checkout", description: "Integração com Corvex Checkout", logo: logoCorvex, webhookFn: "webhook-corvex" },
  { id: "adoorei", name: "Adoorei Checkout", description: "Integração com Adoorei Checkout", logo: logoAdoorei, webhookFn: "webhook-adoorei" },
];

export default function Integracoes() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { loja } = useLoja();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const queryClient = useQueryClient();

  // Fetch checkout integration statuses from DB
  const { data: checkoutStatuses = [] } = useQuery({
    queryKey: ["checkout-integrations", loja?.id],
    queryFn: async () => {
      if (!loja?.id) return [];
      const { data, error } = await supabase
        .from("checkout_integrations")
        .select("checkout_id, ativo")
        .eq("loja_id", loja.id);
      if (error) throw error;
      return (data ?? []) as { checkout_id: string; ativo: boolean }[];
    },
    enabled: !!loja?.id,
  });

  const activeMap: Record<string, boolean> = {};
  checkoutStatuses.forEach((s) => { activeMap[s.checkout_id] = s.ativo; });

  const toggleCheckoutMutation = useMutation({
    mutationFn: async (checkoutId: string) => {
      if (!loja?.id) throw new Error("Sem loja");
      const currentlyActive = !!activeMap[checkoutId];
      const { error } = await supabase
        .from("checkout_integrations")
        .upsert(
          { loja_id: loja.id, checkout_id: checkoutId, ativo: !currentlyActive, updated_at: new Date().toISOString() },
          { onConflict: "loja_id,checkout_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checkout-integrations", loja?.id] });
      queryClient.invalidateQueries({ queryKey: ["checkout-integrations-dashboard", loja?.id] });
    },
    onError: () => toast({ title: "Erro ao alterar status", variant: "destructive" }),
  });

  const getWebhookUrl = (checkout: typeof checkouts[0]) => {
    const token = loja?.webhook_token || "SEU_TOKEN";
    return `${WEBHOOK_BASE}/${checkout.webhookFn}?token=${token}`;
  };

  const copyWebhook = async (checkout: typeof checkouts[0]) => {
    const url = getWebhookUrl(checkout);
    await navigator.clipboard.writeText(url);
    setCopiedId(checkout.id);
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
                    {getWebhookUrl(checkout)}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 glass border-primary/20 hover:border-primary/40 h-9 w-9"
                    onClick={() => copyWebhook(checkout)}
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
                <Switch checked={isActive} onCheckedChange={() => toggleCheckoutMutation.mutate(checkout.id)} disabled={toggleCheckoutMutation.isPending} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
