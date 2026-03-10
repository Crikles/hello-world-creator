import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLoja } from "@/contexts/LojaContext";

export default function Configuracoes() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { loja } = useLoja();
  const queryClient = useQueryClient();

  const { data: logisticaProvider = "jl" } = useQuery({
    queryKey: ["loja-logistica", loja?.id],
    queryFn: async () => {
      if (!loja?.id) return "jl";
      const { data, error } = await supabase
        .from("lojas")
        .select("logistica_provider")
        .eq("id", loja.id)
        .single();
      if (error) throw error;
      return data?.logistica_provider || "jl";
    },
    enabled: !!loja?.id,
  });

  const mutation = useMutation({
    mutationFn: async (provider: "jl" | "jadlog") => {
      if (!loja?.id) return;
      const { error } = await supabase
        .from("lojas")
        .update({ logistica_provider: provider })
        .eq("id", loja.id);
      if (error) throw error;
      return provider;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loja-logistica", loja?.id] });
      toast.success("Logística padrão atualizada!");
    },
    onError: (err: any) => {
      toast.error("Erro ao atualizar: " + err.message);
    },
  });

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error("Preencha todos os campos.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (error) {
      toast.error("Erro ao alterar senha: " + error.message);
    } else {
      toast.success("Senha alterada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <>
      <h1 className="text-lg font-semibold text-foreground mb-4">Configurações</h1>
      <div className="space-y-4 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="h-4 w-4" />
              Alterar Senha
            </CardTitle>
            <CardDescription>Atualize sua senha de acesso ao sistema.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-xs">Nova Senha</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-password" className="text-xs">Confirmar Nova Senha</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button onClick={handleChangePassword} disabled={loading} className="w-full">
              {loading ? "Salvando..." : "Alterar Senha"}
            </Button>
          </CardContent>
        </Card>

        {loja && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Truck className="h-4 w-4" />
                Logística de Envios
              </CardTitle>
              <CardDescription>Escolha a transportadora padrão para os novos pedidos desta loja.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => mutation.mutate("jl")}
                  disabled={mutation.isPending}
                  className={`flex flex-col items-center justify-center p-6 border-2 rounded-xl transition-all ${logisticaProvider === "jl"
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-primary/50"
                    }`}
                >
                  <img src="/logojltransportes.png" alt="JL Transportes" className="max-h-12 mb-3 object-contain" />
                  <span className={`font-semibold text-sm ${logisticaProvider === "jl" ? "text-primary" : "text-muted-foreground"}`}>JL Transportes</span>
                </button>
                <button
                  onClick={() => mutation.mutate("jadlog")}
                  disabled={mutation.isPending}
                  className={`flex flex-col items-center justify-center p-6 border-2 rounded-xl transition-all ${logisticaProvider === "jadlog"
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-primary/50"
                    }`}
                >
                  <img src="/logojadlog.png" alt="JADLOG" className="max-h-12 mb-3 object-contain" />
                  <span className={`font-semibold text-sm ${logisticaProvider === "jadlog" ? "text-primary" : "text-muted-foreground"}`}>JADLOG</span>
                </button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
