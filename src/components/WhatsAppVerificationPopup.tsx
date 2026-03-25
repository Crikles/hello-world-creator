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
  const [step, setStep] = useState<"prompt" | "code">("prompt");
  const [code, setCode] = useState("");

  // Check if user needs verification
  const { data: needsVerification, isLoading } = useQuery({
    queryKey: ["whatsapp-verification-check", user?.id],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("whatsapp, email")
        .eq("id", user!.id)
        .maybeSingle();

      if (!profile?.whatsapp) return false;

      const phone = profile.whatsapp.replace(/\D/g, "");
      const email = (profile.email || "").toLowerCase();

      const { data: verifications } = await supabase
        .from("signup_verifications")
        .select("id")
        .eq("status", "verificado")
        .or(`phone.eq.${phone},email.eq.${email}`)
        .limit(1);

      if (verifications && verifications.length > 0) return false;

      return true;
    },
    enabled: !!user,
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
      queryClient.invalidateQueries({ queryKey: ["whatsapp-verification-check"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Código inválido ou expirado.");
    },
  });

  if (isLoading || !needsVerification) return null;

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

        {step === "prompt" ? (
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Enviaremos um código de verificação para o WhatsApp cadastrado na sua conta.
            </p>
            <Button
              className="w-full"
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
