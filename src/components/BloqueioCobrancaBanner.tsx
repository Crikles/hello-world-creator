import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Coins, Settings, Filter } from "lucide-react";

interface Block {
  motivo: "auto_envio_off" | "saldo_insuficiente" | "filtro_metodo" | "outro" | null;
  envios_travados: number;
  pedidos_descartados: number;
  saldo: number;
  custo_estimado: number;
  auto_envio: boolean | null;
  filtro_metodo: string | null;
}

export function BloqueioCobrancaBanner() {
  const { loja } = useLoja();

  const { data } = useQuery({
    queryKey: ["my-debit-blocks", loja?.id],
    queryFn: async () => {
      if (!loja?.id) return null;
      const { data, error } = await supabase.rpc("get_my_debit_blocks", { p_loja_id: loja.id });
      if (error) throw error;
      return (data?.[0] || null) as Block | null;
    },
    enabled: !!loja?.id,
    refetchInterval: 60_000,
  });

  if (!data || !data.motivo) return null;
  if (data.envios_travados === 0 && data.pedidos_descartados === 0) return null;

  const messages: Record<string, { title: string; desc: string; cta?: { label: string; to: string }; icon: React.ReactNode }> = {
    auto_envio_off: {
      title: `${data.envios_travados} envio(s) parado(s) — envio automático está desligado`,
      desc: "Seus pedidos chegaram, mas o sistema não vai cobrar nem disparar e-mails enquanto o envio automático estiver desligado.",
      cta: { label: "Ativar envio automático", to: "/postagens" },
      icon: <Settings className="h-4 w-4" />,
    },
    saldo_insuficiente: {
      title: `Saldo insuficiente — ${data.envios_travados} envio(s) travado(s)`,
      desc: `Seu saldo é R$ ${Number(data.saldo).toFixed(2)} mas cada envio custa R$ ${Number(data.custo_estimado).toFixed(2)}. Recarregue para destravar.`,
      cta: { label: "Recarregar moedas", to: "/moedas" },
      icon: <Coins className="h-4 w-4" />,
    },
    filtro_metodo: {
      title: `${data.pedidos_descartados} pedido(s) pago(s) descartado(s) por filtro de método`,
      desc: `Sua integração está configurada para processar apenas "${data.filtro_metodo}". Pedidos com outros métodos não viram envio.`,
      cta: { label: "Ajustar integração", to: "/integracoes" },
      icon: <Filter className="h-4 w-4" />,
    },
    outro: {
      title: `${data.envios_travados} envio(s) parado(s)`,
      desc: "Verifique sua configuração de postagens e saldo.",
      cta: { label: "Ver postagens", to: "/postagens" },
      icon: <AlertTriangle className="h-4 w-4" />,
    },
  };

  const m = messages[data.motivo];

  return (
    <Alert variant="destructive" className="mb-4 border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-100 [&>svg]:text-amber-600">
      {m.icon}
      <AlertTitle>{m.title}</AlertTitle>
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
        <span className="flex-1">{m.desc}</span>
        {m.cta && (
          <Button asChild size="sm" variant="outline" className="bg-background">
            <Link to={m.cta.to}>{m.cta.label}</Link>
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
