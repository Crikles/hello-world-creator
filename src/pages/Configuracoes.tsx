import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mail } from "lucide-react";

export default function Configuracoes() {
  return (
    <>
      <h1 className="text-lg font-semibold text-foreground mb-4">Configurações</h1>
      <div className="space-y-4 max-w-2xl">
        <p className="text-muted-foreground">
          Configurações avançadas da loja.
        </p>
      </div>
    </>
  );
}
