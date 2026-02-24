import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const WEBHOOK_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

const checkouts = [
  { id: "vega", name: "Vega Checkout", description: "Integração com Vega Checkout", color: "hsl(var(--primary))" },
  { id: "zedy", name: "Zedy Checkout", description: "Integração com Zedy Checkout", color: "hsl(var(--accent))" },
  { id: "luna", name: "Luna Checkout", description: "Integração com Luna Checkout", color: "hsl(var(--secondary))" },
  { id: "corvex", name: "Corvex Checkout", description: "Integração com Corvex Checkout", color: "hsl(var(--muted-foreground))" },
];

export default function Integracoes() {
  const [activeMap, setActiveMap] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleCheckout = (id: string) => {
    setActiveMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyWebhook = async (id: string) => {
    const url = `${WEBHOOK_BASE}/webhook-${id}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast({ title: "URL copiada!", description: "Webhook copiado para a área de transferência." });
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <AppLayout title="Integrações">
      <div className="space-y-2 mb-6">
        <p className="text-sm text-muted-foreground">
          Conecte seus checkouts para receber pedidos automaticamente via webhook.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {checkouts.map((checkout) => {
          const isActive = !!activeMap[checkout.id];
          return (
            <Card key={checkout.id} className="relative overflow-hidden">
              <CardHeader className="flex flex-row items-center gap-4 pb-2">
                {/* Placeholder logo */}
                <div
                  className="h-12 w-12 rounded-lg flex items-center justify-center text-lg font-bold text-primary-foreground shrink-0"
                  style={{ backgroundColor: checkout.color }}
                >
                  {checkout.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-base text-foreground">{checkout.name}</h3>
                    <Badge variant={isActive ? "default" : "secondary"}>
                      {isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{checkout.description}</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Webhook URL */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Webhook URL</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-md truncate text-foreground">
                      {WEBHOOK_BASE}/webhook-{checkout.id}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0"
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
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm text-muted-foreground">Ativar integração</span>
                  <Switch checked={isActive} onCheckedChange={() => toggleCheckout(checkout.id)} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AppLayout>
  );
}
