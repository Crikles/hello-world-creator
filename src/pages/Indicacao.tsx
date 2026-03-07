import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, Check, Users, Coins, Gift, Share2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Indicacao() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile-referral", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("referral_code")
        .eq("id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const { data: earnings } = useQuery({
    queryKey: ["referral-earnings", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("referral_earnings" as any)
        .select("*")
        .eq("referrer_id", user!.id)
        .order("created_at", { ascending: false });
      return (data || []) as unknown as Array<{
        id: string;
        referrer_id: string;
        referred_id: string;
        pix_payment_id: string;
        amount_earned: number;
        created_at: string;
      }>;
    },
    enabled: !!user,
  });

  const { data: referredCount } = useQuery({
    queryKey: ["referred-count", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("referred_by", user!.id);
      return count || 0;
    },
    enabled: !!user,
  });

  const referralCode = profile?.referral_code || "";
  const referralLink = `https://app.magnusfrete.site/signup?ref=${referralCode}`;
  const totalEarned = earnings?.reduce((sum, e) => sum + Number(e.amount_earned), 0) || 0;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Indicação</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Indique amigos e ganhe 10% de cada recarga feita por eles
        </p>
      </div>

      {/* Referral link card */}
      <Card className="glass glow-border overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Share2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Seu link de indicação</h3>
              <p className="text-xs text-muted-foreground">Compartilhe e ganhe moedas a cada recarga</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-muted/50 rounded-xl px-4 py-3 text-sm text-foreground font-mono truncate border border-primary/10">
              {referralLink}
            </div>
            <Button
              onClick={handleCopy}
              size="sm"
              className="rounded-xl shrink-0 gap-2"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
          <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/10">
            <div className="flex items-center gap-2 text-sm">
              <Gift className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">
                Você recebe <span className="text-primary font-bold">10%</span> de cada recarga feita por quem se cadastrar pelo seu link
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="glass">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{referredCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">Indicados</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Coins className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {totalEarned.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground">Moedas ganhas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{earnings?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Comissões recebidas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Earnings history */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="h-4 w-4 text-primary" />
            Histórico de comissões
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!earnings || earnings.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Nenhuma comissão ainda</p>
              <p className="text-xs mt-1">Compartilhe seu link para começar a ganhar!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Moedas ganhas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {earnings.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm">
                      {format(new Date(e.created_at), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-0">
                        +{Number(e.amount_earned).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
