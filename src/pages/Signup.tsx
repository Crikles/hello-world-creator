import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isLogisticsDomain } from "@/lib/domain-config";
import { AuthForm } from "@/components/ui/premium-auth";

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

  const handleSignup = async (emailVal: string, password: string, name: string, phone: string) => {
    setLoading(true);
    const refCode = localStorage.getItem("referral_code") || "";
    const { error } = await supabase.auth.signUp({
      email: emailVal,
      password,
      options: {
        data: { full_name: name, whatsapp: phone, ...(refCode ? { referral_code: refCode } : {}) },
        emailRedirectTo: window.location.origin + "/login",
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setEmail(emailVal);
      setSuccess(true);
    }
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
        logo={isLogistics ? "/logojltransportes.png" : "/logo-magnus.png"}
        logoAlt={isLogistics ? "Logística JL Transportes" : "Magnus Frete"}
        subtitle="Comece a gerenciar seus envios"
      />
    </div>
  );
}
