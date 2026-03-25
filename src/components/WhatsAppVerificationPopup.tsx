import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [code, setCode] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneLoaded, setPhoneLoaded] = useState(false);
  const [verificationCompleted, setVerificationCompleted] = useState(false);

  // Check if user needs verification
  const { data: needsVerification, isLoading } = useQuery({
    queryKey: ["whatsapp-verification-check", user?.id],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("whatsapp, email")
        .eq("id", user!.id)
        .maybeSingle();

      // Pre-fill the phone input
      if (!phoneLoaded) {
        setPhoneInput(profile?.whatsapp || "");
        setPhoneLoaded(true);
      }

      const phone = (profile?.whatsapp || "").replace(/\D/g, "");
      const email = (profile?.email || "").toLowerCase();

      // If no phone AND no email, still show popup to collect phone
      if (!phone && !email) return true;

      const conditions: string[] = [];
      if (phone) conditions.push(`phone.eq.${phone}`);
      if (email) conditions.push(`email.eq.${email}`);

      const { data: verifications } = await supabase
        .from("signup_verifications")
        .select("id")
        .eq("status", "verificado")
        .or(conditions.join(","))
        .limit(1);

      return !(verifications && verifications.length > 0);
    },
    enabled: !!user && !verificationCompleted,
  });

  const sendCodeMutation = useMutation({
    mutationFn: async () => {
      if (!phoneInput.trim()) throw new Error("Informe seu WhatsApp.");

      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", user!.id)
        .maybeSingle();

      // Save the confirmed phone to profile
      await supabase
        .from("profiles")
        .update({ whatsapp: phoneInput.trim() })
        .eq("id", user!.id);

      const { data, error } = await supabase.functions.invoke("send-verification-sms", {
        body: {
          phone: phoneInput.trim(),
          email: profile?.email,
          full_name: profile?.full_name || "Usuário",
          skip_email_check: true,
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
      const { data, error } = await supabase.functions.invoke("verify-sms-code", {
        body: {
          phone: phoneInput.trim(),
          code,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      setVerificationCompleted(true);
      setCode("");
      toast.success("WhatsApp verificado com sucesso! ✅");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-verification-check", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-pending-verifications"] });
      queryClient.invalidateQueries({ queryKey: ["admin-usuarios"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Código inválido ou expirado.");
    },
  });

  if (verificationCompleted || isLoading || !needsVerification) return null;

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-sm [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Verifique seu WhatsApp
          </DialogTitle>
          <DialogDescription>
            A verificação do WhatsApp é obrigatória para continuar utilizando a plataforma.
          </DialogDescription>
        </DialogHeader>

        {step === "phone" ? (
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Confirme ou atualize seu número de WhatsApp. Enviaremos um código de verificação.
            </p>
            <div className="space-y-2">
              <Label>Número do WhatsApp (com DDD e código do país)</Label>
              <Input
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="5511999999999"
                className="font-mono"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => sendCodeMutation.mutate()}
              disabled={sendCodeMutation.isPending || !phoneInput.trim()}
            >
              {sendCodeMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4 mr-2" />
              )}
              Enviar Código
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2">
              <div className="text-sm">
                <span className="text-muted-foreground">Enviado para: </span>
                <span className="font-mono font-medium">{phoneInput}</span>
              </div>
              <Button
                variant="link"
                size="sm"
                className="text-xs h-auto p-0"
                onClick={() => { setStep("phone"); setCode(""); }}
              >
                Alterar número
              </Button>
            </div>
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
