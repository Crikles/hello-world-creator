import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Smartphone, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function WhatsAppVerificationPopup() {
  const { user } = useAuth();
  const [step, setStep] = useState<"prompt" | "code">("prompt");
  const [code, setCode] = useState("");
  const [dismissed, setDismissed] = useState(() => {
    return sessionStorage.getItem("whatsapp_verify_dismissed") === "true";
  });

  // Check if user needs verification
  const { data: needsVerification, isLoading } = useQuery({
    queryKey: ["whatsapp-verification-check", user?.id],
    queryFn: async () => {
      // Get user profile for phone
      const { data: profile } = await supabase
        .from("profiles")
        .select("whatsapp, email")
        .eq("id", user!.id)
        .maybeSingle();

      if (!profile?.whatsapp) return false;

      const phone = profile.whatsapp.replace(/\D/g, "");
      const email = (profile.email || "").toLowerCase();

      // Check if already verified
      const { data: verifications } = await supabase
        .from("signup_verifications")
        .select("id")
        .eq("status", "verificado")
        .or(`phone.eq.${phone},email.eq.${email}`)
        .limit(1);

      // If already verified, no need for popup
      if (verifications && verifications.length > 0) return false;

      return true;
    },
    enabled: !!user && !dismissed,
  });

  const sendCodeMutation = useMutation({
    mutationFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("whatsapp, email, full_name")
        .eq("id", user!.id)
        .maybeSingle();

      if (!profile?.whatsapp) throw new Error("WhatsApp não cadastrado.");

      const { data, error } = await supabase.functions.invoke("send-verification-sms", {
        body: {
          phone: profile.whatsapp,
          email: profile.email,
          full_name: profile.full_name || "Usuário",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      setStep("code");
      toast.success("Código enviado para seu WhatsApp!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao enviar código.");
    },
  });

  const verifyCodeMutation = useMutation({
    mutationFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("whatsapp")
        .eq("id", user!.id)
        .maybeSingle();

      const { data, error } = await supabase.functions.invoke("verify-sms-code", {
        body: {
          phone: profile?.whatsapp,
          code,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("WhatsApp verificado com sucesso! ✅");
      setDismissed(true);
      sessionStorage.setItem("whatsapp_verify_dismissed", "true");
    },
    onError: (err: any) => {
      toast.error(err.message || "Código inválido ou expirado.");
    },
  });

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("whatsapp_verify_dismissed", "true");
  };

  if (isLoading || !needsVerification || dismissed) return null;

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) handleDismiss(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Verifique seu WhatsApp
          </DialogTitle>
          <DialogDescription>
            Para maior segurança da sua conta, precisamos verificar seu número de WhatsApp.
          </DialogDescription>
        </DialogHeader>

        {step === "prompt" ? (
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Enviaremos um código de verificação para o WhatsApp cadastrado na sua conta.
            </p>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => sendCodeMutation.mutate()}
                disabled={sendCodeMutation.isPending}
              >
                {sendCodeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4 mr-2" />
                )}
                Enviar Código
              </Button>
              <Button variant="ghost" onClick={handleDismiss}>
                Depois
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Código de verificação</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="text-center text-lg tracking-widest font-mono"
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => verifyCodeMutation.mutate()}
                disabled={verifyCodeMutation.isPending || code.length !== 6}
              >
                {verifyCodeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4 mr-2" />
                )}
                Verificar
              </Button>
              <Button
                variant="outline"
                onClick={() => sendCodeMutation.mutate()}
                disabled={sendCodeMutation.isPending}
              >
                Reenviar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
