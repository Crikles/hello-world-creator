import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Settings, Webhook, Mail } from "lucide-react";

export default function Configuracoes() {
  return (
    <AppLayout title="Configurações">
      <div className="space-y-4 max-w-2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Webhook className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">Webhook</CardTitle>
                <CardDescription>Receba pedidos automaticamente de plataformas de checkout</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Em breve: Endpoint de webhook para integrar com Kiwify, Hotmart, etc.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">Email</CardTitle>
                <CardDescription>Configuração de envio de emails automáticos</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Em breve: Configuração do Resend para envio de emails com NFe e rastreio.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
