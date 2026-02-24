import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mail } from "lucide-react";

export default function Configuracoes() {
  return (
    <AppLayout title="Configurações">
      <div className="space-y-4 max-w-2xl">
        <p className="text-muted-foreground">
          Nenhuma configuração disponível no momento.
        </p>
      </div>
    </AppLayout>
  );
}
