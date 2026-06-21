import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, Coins, Phone, Link } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface SystemConfig {
  key: string;
  value: number;
  label: string | null;
}

// Keys that store text in the `label` field instead of numeric `value`
const TEXT_KEYS = ["tracking_base_url"];

export default function AdminValores() {
  const queryClient = useQueryClient();
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [localLabels, setLocalLabels] = useState<Record<string, string>>({});

  const { data: rawConfigs, isLoading } = useQuery({
    queryKey: ["system-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_config")
        .select("*")
        .order("key");
      if (error) throw error;
      return (data ?? []) as SystemConfig[];
    },
  });

  const configs = Array.isArray(rawConfigs) ? rawConfigs : [];

  // Stringify to avoid infinite re-render from new array reference
  const configsJson = JSON.stringify(configs);

  useEffect(() => {
    const parsed = JSON.parse(configsJson) as SystemConfig[];
    if (parsed.length) {
      const values: Record<string, string> = {};
      const labels: Record<string, string> = {};
      parsed.forEach((c) => {
        values[c.key] = String(c.value);
        labels[c.key] = c.label || "";
      });
      setLocalValues(values);
      setLocalLabels(labels);
    }
  }, [configsJson]);

  const hasChanges = configs.some((c) => {
    if (TEXT_KEYS.includes(c.key)) {
      return localLabels[c.key] !== undefined && localLabels[c.key] !== (c.label || "");
    }
    return localValues[c.key] !== undefined && localValues[c.key] !== String(c.value);
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!configs) return;
      for (const config of configs) {
        if (TEXT_KEYS.includes(config.key)) {
          const newLabel = localLabels[config.key];
          if (newLabel !== undefined && newLabel !== (config.label || "")) {
            const { error } = await supabase
              .from("system_config")
              .update({ label: newLabel })
              .eq("key", config.key);
            if (error) throw error;
          }
        } else {
          const newVal = parseFloat(localValues[config.key]);
          if (!isNaN(newVal) && newVal !== config.value) {
            const { error } = await supabase
              .from("system_config")
              .update({ value: newVal })
              .eq("key", config.key);
            if (error) throw error;
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-config"] });
      toast({ title: "Valores atualizados com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao salvar valores", variant: "destructive" });
    },
  });

  const getIcon = (key: string) => {
    if (key === "whatsapp_suporte") return <Phone className="h-4 w-4 text-green-500" />;
    if (TEXT_KEYS.includes(key)) return <Link className="h-4 w-4 text-blue-500" />;
    return <Coins className="h-4 w-4 text-amber-500" />;
  };

  const getDisplayLabel = (config: SystemConfig) => {
    if (config.key === "tracking_base_url") return "URL Base do Rastreio";
    return config.label || config.key;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Valores</h1>
            <p className="text-muted-foreground">
              Gerencie os custos em moedas de cada serviço do sistema
            </p>
          </div>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!hasChanges || saveMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            Salvar Alterações
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : (
          (() => {
            const groups: { title: string; match: (k: string) => boolean }[] = [
              { title: "Rastreio & NF-e", match: (k) => ["custo_email_rastreio", "custo_sms_rastreio", "custo_nfe_email"].includes(k) },
              { title: "Confirmação de Pagamento", match: (k) => k.startsWith("custo_confirmacao_") },
              { title: "Global (Internacional)", match: (k) => k.startsWith("custo_global_flow_") },
              { title: "Recuperação de Vendas", match: (k) => k.startsWith("custo_recovery_") },
              { title: "Upsell", match: (k) => k === "custo_upsell_email" },
              { title: "WhatsApp (assinatura mensal por instância)", match: (k) => k === "custo_whatsapp" },
              { title: "Suporte & Domínio", match: (k) => k === "whatsapp_suporte" || TEXT_KEYS.includes(k) },
            ];
            const used = new Set<string>();
            const sections = groups.map((g) => {
              const items = configs.filter((c) => g.match(c.key));
              items.forEach((c) => used.add(c.key));
              return { ...g, items };
            });
            const rest = configs.filter((c) => !used.has(c.key));
            if (rest.length) sections.push({ title: "Outros", match: () => true, items: rest });

            return (
              <div className="space-y-8">
                {sections.filter((s) => s.items.length > 0).map((section) => (
                  <div key={section.title} className="space-y-3">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      {section.title}
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {section.items.map((config) => (
                        <Card key={config.key}>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                              {getIcon(config.key)}
                              {getDisplayLabel(config)}
                            </CardTitle>
                            <CardDescription className="text-xs font-mono">
                              {config.key}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            {TEXT_KEYS.includes(config.key) ? (
                              <div className="space-y-1">
                                <Input
                                  type="url"
                                  value={localLabels[config.key] ?? ""}
                                  onChange={(e) =>
                                    setLocalLabels((prev) => ({
                                      ...prev,
                                      [config.key]: e.target.value,
                                    }))
                                  }
                                  className="w-full"
                                  placeholder="https://rastreio.seudominio.com"
                                />
                                <p className="text-xs text-muted-foreground">
                                  Se o domínio cair, mude aqui e todos os links antigos continuam funcionando
                                </p>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  step={config.key === "whatsapp_suporte" ? "1" : "0.01"}
                                  min="0"
                                  value={localValues[config.key] ?? ""}
                                  onChange={(e) =>
                                    setLocalValues((prev) => ({
                                      ...prev,
                                      [config.key]: e.target.value,
                                    }))
                                  }
                                  className="w-full"
                                  placeholder={config.key === "whatsapp_suporte" ? "Ex: 5511999999999" : ""}
                                />
                                {config.key !== "whatsapp_suporte" && (
                                  <Label className="text-xs text-muted-foreground whitespace-nowrap">
                                    moedas
                                  </Label>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()
        )}

      </div>
    </AdminLayout>
  );
}
