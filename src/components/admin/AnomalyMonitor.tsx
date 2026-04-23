import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ShieldCheck } from "lucide-react";

interface Anomaly {
  user_id: string;
  email: string | null;
  recarga_at: string;
  consumos_5min: number;
  total_debitado: number;
}

/**
 * Detects users who suffered the "mass advancement" pattern in the last 7 days:
 * ≥20 credit consumptions within 5 minutes of a successful PIX recharge.
 * The bug was patched on 23/04 in retry-failed-sends — this panel ensures it
 * does not silently regress.
 */
export function AnomalyMonitor() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-recharge-anomalies"],
    queryFn: async (): Promise<Anomaly[]> => {
      const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

      // 1. Get successful PIX recharges in last 7d
      const { data: pix } = await supabase
        .from("pix_payments")
        .select("user_id, paid_at")
        .eq("status", "PAID")
        .gte("paid_at", since)
        .order("paid_at", { ascending: false });

      if (!pix || pix.length === 0) return [];

      const anomalies: Anomaly[] = [];

      // 2. For each recharge, count consumos in next 5 min
      for (const p of pix) {
        if (!p.paid_at) continue;
        const start = new Date(p.paid_at).toISOString();
        const end = new Date(new Date(p.paid_at).getTime() + 5 * 60_000).toISOString();

        const { data: txs } = await supabase
          .from("creditos_transacoes")
          .select("quantidade")
          .eq("user_id", p.user_id)
          .eq("tipo", "consumo")
          .gte("created_at", start)
          .lte("created_at", end);

        const count = txs?.length ?? 0;
        if (count >= 20) {
          const total = (txs || []).reduce((s, t) => s + Number(t.quantidade || 0), 0);
          anomalies.push({
            user_id: p.user_id,
            email: null,
            recarga_at: p.paid_at,
            consumos_5min: count,
            total_debitado: total,
          });
        }
      }

      // 3. Enrich with profile email
      if (anomalies.length > 0) {
        const ids = [...new Set(anomalies.map((a) => a.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", ids);
        const emailMap = new Map(profiles?.map((p) => [p.id, p.email]) ?? []);
        anomalies.forEach((a) => { a.email = emailMap.get(a.user_id) ?? "—"; });
      }

      return anomalies;
    },
    refetchInterval: 5 * 60_000,
  });

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center gap-3">
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <CardTitle className="text-lg">Monitor de Avanços Anômalos</CardTitle>
          <p className="text-xs text-muted-foreground">
            Detecta padrão "≥20 consumos em 5 min após recarga PIX" (últimos 7 dias)
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !data || data.length === 0 ? (
          <div className="flex items-center gap-3 py-4 text-sm text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
            Nenhuma anomalia detectada nos últimos 7 dias.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border/50">
                  <th className="py-2 pr-4">Usuário</th>
                  <th className="py-2 pr-4">Recarga em</th>
                  <th className="py-2 pr-4 text-right">Consumos (5min)</th>
                  <th className="py-2 text-right">Total debitado</th>
                </tr>
              </thead>
              <tbody>
                {data.map((a, i) => (
                  <tr key={i} className="border-b border-border/30 last:border-0">
                    <td className="py-2 pr-4 text-foreground">{a.email}</td>
                    <td className="py-2 pr-4 text-muted-foreground tabular-nums">
                      {new Date(a.recarga_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="py-2 pr-4 text-right font-semibold text-amber-400 tabular-nums">
                      {a.consumos_5min}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {a.total_debitado.toFixed(2)} moedas
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
