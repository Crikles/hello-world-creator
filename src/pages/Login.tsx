import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isLogisticsDomain } from "@/lib/domain-config";
import { AuthForm } from "@/components/ui/premium-auth";

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const isLogistics = isLogisticsDomain();

  const handleLogin = async (email: string, password: string) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      navigate("/lojas");
    }
  };

  const handleReset = async (email: string) => {
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Link de redefinição enviado! Verifique seu email.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <AuthForm
        initialMode="login"
        loading={loading}
        onLogin={handleLogin}
        onReset={handleReset}
        logo={isLogistics ? "/logojltransportes.png" : "/logo-magnus.png"}
        logoAlt={isLogistics ? "Logística JL Transportes" : "Magnus Frete"}
        title={isLogistics ? "Logística JL Transportes" : undefined}
        subtitle={isLogistics ? "Gestão de Envios & Rastreio" : "Plataforma de Gestão de Fretes"}
      />
    </div>
  );
}
