import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HeadphonesIcon, Save } from "lucide-react";
import { toast } from "sonner";

export default function AdminSuporte() {
  const queryClient = useQueryClient();
  const [numero, setNumero] = useState("");

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(numero.replace(/\D/g, ""));
    if (isNaN(val) || val <= 0) {
      toast.error("Número inválido.");
      return;
    }
    updateMutation.mutate(val);
  };

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-foreground mb-6">Suporte</h1>

      <Card className="max-w-lg">
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
    </AdminLayout>
  );
}
