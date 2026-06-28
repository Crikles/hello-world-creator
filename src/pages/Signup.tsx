import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isLogisticsDomain } from "@/lib/domain-config";
import { AuthForm } from "@/components/ui/premium-auth";
import { translateAuthError } from "@/lib/auth-errors";

export default function Signup() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);
  const isLogistics = isLogisticsDomain();
  const [searchParams] = useSearchParams();

  // Capture referral code from URL
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      localStorage.setItem("referral_code", ref);
    }
  }, [searchParams]);

  const translateAuthError = (msg: string): string => {
    const m = msg.toLowerCase();
    if (m.includes("already registered") || m.includes("user already")) {
      return "Este e-mail já está cadastrado. Faça login.";
    }
    if (m.includes("password") && m.includes("6")) {
      return "A senha precisa ter no mínimo 6 caracteres.";
    }
    if (m.includes("invalid") && m.includes("email")) {
      return "E-mail inválido.";
    }
    if (m.includes("rate") || m.includes("too many")) {
      return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
    }
    return msg;
  };

  const handleSignup = async (emailVal: string, password: string, name: string, phone: string): Promise<boolean> => {
    setLoading(true);
    const refCode = localStorage.getItem("referral_code") || "";
    const { data, error } = await supabase.auth.signUp({
      email: emailVal,
      password,
      options: {
        data: { full_name: name, whatsapp: phone, ...(refCode ? { referral_code: refCode } : {}) },
        emailRedirectTo: window.location.origin + "/login",
      },
    });
    setLoading(false);
    if (error) {
      toast.error(translateAuthError(error.message));
      return false;
    }
    // Supabase returns 200 with empty identities when the e-mail already exists
    // (to avoid user enumeration). Detect and surface a clear error.
    if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      toast.error("Este e-mail já está cadastrado. Faça login.");
      return false;
    }
    setEmail(emailVal);
    setSuccess(true);
    localStorage.removeItem("referral_code");
    return true;
  };

  const handleResend = async () => {
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: window.location.origin + "/login" },
    });
    setResending(false);
    if (error) toast.error(error.message);
    else toast.success("Email reenviado com sucesso!");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <AuthForm
        initialMode="signup"
        loading={loading}
        onSignup={handleSignup}
        signupSuccess={success}
        signupEmail={email}
        onResendEmail={handleResend}
        resending={resending}
        logo={isLogistics ? "/logo-azul.svg" : "/logo-magnus.png"}
        logoAlt={isLogistics ? "ATLAS Cargo Express" : "Magnus Frete"}
        subtitle="Comece a gerenciar seus envios"
      />
    </div>
  );
}
