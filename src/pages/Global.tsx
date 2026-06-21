import { useEffect, useState } from "react";
import { Globe2, Mail, MessageSquare, CheckCircle2, Circle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useLoja } from "@/contexts/LojaContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STEPS = {
  en: [
    "Order Received",
    "Order Prepared",
    "Shipped by Sender",
    "Left Country of Origin",
    "In International Transit",
    "Arrived at Destination Country",
    "In Customs Processing",
    "In Local Transit",
    "Out for Delivery",
    "Delivered",
  ],
  es: [
    "Pedido Recibido",
    "Pedido Preparado",
    "Enviado por el Remitente",
    "Salió del País de Origen",
    "En Tránsito Internacional",
    "Llegó al País de Destino",
    "En Procesamiento Aduanero",
    "En Tránsito Local",
    "Salió para Entrega",
    "Entregado",
  ],
};

export default function Global() {
  const { loja } = useLoja();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ativo, setAtivo] = useState(false);
  const [idioma, setIdioma] = useState<"en" | "es">("en");
  const [enviarEmail, setEnviarEmail] = useState(true);
  const [enviarSms, setEnviarSms] = useState(true);

  useEffect(() => {
    if (!loja?.id) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("global_flow_config")
        .select("*")
        .eq("loja_id", loja.id)
        .maybeSingle();
      if (data) {
        setAtivo(data.ativo);
        setIdioma((data.idioma as "en" | "es") || "en");
        setEnviarEmail(data.enviar_email);
        setEnviarSms(data.enviar_sms);
      }
      setLoading(false);
    })();
  }, [loja?.id]);

  const save = async (patch: Partial<{ ativo: boolean; idioma: "en" | "es"; enviar_email: boolean; enviar_sms: boolean }>) => {
    if (!loja?.id) return;
    setSaving(true);
    const payload = {
      loja_id: loja.id,
      ativo,
      idioma,
      enviar_email: enviarEmail,
      enviar_sms: enviarSms,
      ...patch,
    };
    const { error } = await supabase
      .from("global_flow_config")
      .upsert(payload, { onConflict: "loja_id" });
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Configuração salva");
    }
  };

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  }

  const steps = STEPS[idioma];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl glass glow-border">
          <Globe2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Fluxo Global</h1>
          <p className="text-sm text-muted-foreground">
            Fluxo internacional padrão de 10 etapas em inglês ou espanhol
          </p>
        </div>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Status</h2>
            <p className="text-sm text-muted-foreground">
              {ativo ? "Fluxo Global ATIVO — pedidos internacionais receberão notificações automáticas." : "Fluxo Global DESATIVADO."}
            </p>
          </div>
          <Switch
            checked={ativo}
            disabled={saving}
            onCheckedChange={(v) => { setAtivo(v); save({ ativo: v }); }}
          />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Idioma</h2>
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant={idioma === "en" ? "default" : "outline"}
            onClick={() => { setIdioma("en"); save({ idioma: "en" }); }}
            disabled={saving}
            className="h-16 text-base"
          >
            🇺🇸 English (US)
          </Button>
          <Button
            variant={idioma === "es" ? "default" : "outline"}
            onClick={() => { setIdioma("es"); save({ idioma: "es" }); }}
            disabled={saving}
            className="h-16 text-base"
          >
            🇪🇸 Español
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Canais</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Email</p>
                <p className="text-xs text-muted-foreground">Enviar email a cada etapa</p>
              </div>
            </div>
            <Switch
              checked={enviarEmail}
              disabled={saving}
              onCheckedChange={(v) => { setEnviarEmail(v); save({ enviar_email: v }); }}
            />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">SMS</p>
                <p className="text-xs text-muted-foreground">Enviar SMS a cada etapa</p>
              </div>
            </div>
            <Switch
              checked={enviarSms}
              disabled={saving}
              onCheckedChange={(v) => { setEnviarSms(v); save({ enviar_sms: v }); }}
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-1">
          {idioma === "en" ? "Tracking flow preview" : "Vista previa del flujo"}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {idioma === "en"
            ? "These are the 10 automated steps your customers will see."
            : "Estos son los 10 pasos automáticos que verán sus clientes."}
        </p>
        <ol className="space-y-2">
          {steps.map((label, i) => (
            <li key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                {i + 1}
              </div>
              <span className="text-sm">{label}</span>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="p-6 bg-muted/30">
        <h3 className="font-semibold mb-2">Como funciona</h3>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Apenas pedidos detectados como internacionais entram neste fluxo.</li>
          <li>Pedidos brasileiros continuam usando o fluxo nacional (Atlas / JetLine) normalmente.</li>
          <li>Não há edição de template — tudo é padrão e traduzido automaticamente.</li>
          <li>O idioma é travado no envio no momento da criação.</li>
        </ul>
      </Card>
    </div>
  );
}
