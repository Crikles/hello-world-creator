import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, Coins } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface SystemConfig {
  key: string;
  value: number;
  label: string | null;
}

export default function AdminValores() {
  const queryClient = useQueryClient();
  const [localValues, setLocalValues] = useState<Record<string, string>>({});

  const { data: configs, isLoading } = useQuery({
    queryKey: ["system-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_config")
        .select("*")
        .order("key");
      if (error) throw error;
      return data as SystemConfig[];
    },
  });

  useEffect(() => {
    if (configs) {
      const values: Record<string, string> = {};
      configs.forEach((c) => {
        values[c.key] = String(c.value);
      });
      setLocalValues(values);
    }
  }, [configs]);

  const hasChanges = configs?.some(
    (c) => localValues[c.key] !== undefined && localValues[c.key] !== String(c.value)
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!configs) return;
      for (const config of configs) {
        const newVal = parseFloat(localValues[config.key]);
        if (!isNaN(newVal) && newVal !== config.value) {
          const { error } = await supabase
            .from("system_config")
            .update({ value: newVal })
            .eq("key", config.key);
          if (error) throw error;
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {configs?.map((config) => (
              <Card key={config.key}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Coins className="h-4 w-4 text-amber-500" />
                    {config.label || config.key}
                  </CardTitle>
                  <CardDescription className="text-xs font-mono">
                    {config.key}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={localValues[config.key] ?? ""}
                      onChange={(e) =>
                        setLocalValues((prev) => ({
                          ...prev,
                          [config.key]: e.target.value,
                        }))
                      }
                      className="w-full"
                    />
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">
                      moedas
                    </Label>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
