import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff, Truck, User, Phone, Mail, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLoja } from "@/contexts/LojaContext";
import { useAuth } from "@/contexts/AuthContext";

export default function Configuracoes() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loadingPw, setLoadingPw] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const { loja } = useLoja();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch profile
  const { data: profile } = useQuery({
    queryKey: ["profile-settings", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, whatsapp")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setWhatsapp(profile.whatsapp || "");
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!user?.id) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, whatsapp })
      .eq("id", user.id);
    setSavingProfile(false);
    if (error) {
      toast.error("Erro ao salvar perfil: " + error.message);
    } else {
      toast.success("Perfil atualizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["profile-settings", user?.id] });
    }
  };

  // Logistica
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

  const logisticaMutation = useMutation({
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
    setLoadingPw(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoadingPw(false);
    if (error) {
      toast.error("Erro ao alterar senha: " + error.message);
    } else {
      toast.success("Senha alterada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <>
      <h1 className="text-lg font-semibold text-foreground mb-4">Configurações</h1>
      <div className="space-y-4 max-w-2xl">

        {/* ── Perfil ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" />
              Meu Perfil
            </CardTitle>
            <CardDescription>Informações pessoais da sua conta.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs flex items-center gap-1.5">
                <Mail className="h-3 w-3 text-muted-foreground" /> E-mail
              </Label>
              <Input
                id="email"
                type="email"
                value={user?.email || ""}
                disabled
                className="opacity-60"
              />
              <p className="text-[11px] text-muted-foreground">O e-mail não pode ser alterado.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="full-name" className="text-xs flex items-center gap-1.5">
                <User className="h-3 w-3 text-muted-foreground" /> Nome Completo
              </Label>
              <Input
                id="full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome completo"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="whatsapp" className="text-xs flex items-center gap-1.5">
                <Phone className="h-3 w-3 text-muted-foreground" /> WhatsApp
              </Label>
              <Input
                id="whatsapp"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>

            <Button onClick={handleSaveProfile} disabled={savingProfile} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              {savingProfile ? "Salvando..." : "Salvar Perfil"}
            </Button>
          </CardContent>
        </Card>

        {/* ── Senha ── */}
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

            <Button onClick={handleChangePassword} disabled={loadingPw} className="w-full">
              {loadingPw ? "Salvando..." : "Alterar Senha"}
            </Button>
          </CardContent>
        </Card>

        {/* ── Logística ── */}
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
                  onClick={() => logisticaMutation.mutate("jl")}
                  disabled={logisticaMutation.isPending}
                  className={`flex flex-col items-center justify-center p-6 border-2 rounded-xl transition-all bg-white ${logisticaProvider === "jl"
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border hover:border-primary/50"
                    }`}
                >
                  <img src="/logojltransportes.png" alt="JL Transportes" className="h-16 mb-3 object-contain" />
                  <span className={`font-semibold text-sm ${logisticaProvider === "jl" ? "text-primary" : "text-slate-600"}`}>JL Transportes</span>
                </button>
                <button
                  onClick={() => logisticaMutation.mutate("jadlog")}
                  disabled={logisticaMutation.isPending}
                  className={`flex flex-col items-center justify-center p-6 border-2 rounded-xl transition-all bg-white ${logisticaProvider === "jadlog"
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border hover:border-primary/50"
                    }`}
                >
                  <img src="/logojadlog.png" alt="JADLOG" className="h-16 mb-3 object-contain" />
                  <span className={`font-semibold text-sm ${logisticaProvider === "jadlog" ? "text-primary" : "text-slate-600"}`}>JADLOG</span>
                </button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
