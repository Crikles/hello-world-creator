import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Coins, QrCode, Copy, Check, Loader2, Sparkles, Clock, CheckCircle2, XCircle, ArrowRight, PencilLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface CoinPackage {
    moedas: number;
    price_cents: number;
    popular?: boolean;
    bonus?: string;
}

const COIN_PACKAGES: CoinPackage[] = [
    { moedas: 50, price_cents: 5000 },
    { moedas: 100, price_cents: 10000, popular: true },
    { moedas: 200, price_cents: 20000 },
    { moedas: 300, price_cents: 30000 },
];

const calcBonus = (moedas: number) => Math.floor(moedas / 100) * 10;

interface PixPaymentData {
    paymentId: string;
    transactionId: string;
    qrCodeBase64: string;
    copyPaste: string;
    expiresAt: string;
    amount_cents: number;
    moedas: number;
}

export default function Moedas() {
    const { user, session, isImpersonating } = useAuth();
    const queryClient = useQueryClient();
    const [selectedPackage, setSelectedPackage] = useState<CoinPackage | null>(null);
    const [loading, setLoading] = useState(false);
    const [pixData, setPixData] = useState<PixPaymentData | null>(null);
    const [copied, setCopied] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState<"idle" | "pending" | "paid" | "error">("idle");
    const [customAmount, setCustomAmount] = useState<string>("");
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const qrCanvasRef = useRef<HTMLCanvasElement>(null);

    // Fetch user's credit balance
    const { data: saldo } = useQuery({
        queryKey: ["meu-saldo", user?.id],
        queryFn: async () => {
            const { data } = await supabase
                .from("creditos")
                .select("saldo")
                .eq("user_id", user!.id)
                .maybeSingle();
            return data?.saldo ?? 0;
        },
        enabled: !!user,
    });

    // Fetch recent transactions
    const { data: transactions = [] } = useQuery({
        queryKey: ["meus-creditos-transacoes", user?.id],
        queryFn: async () => {
            const { data } = await supabase
                .from("creditos_transacoes")
                .select("*")
                .eq("user_id", user!.id)
                .order("created_at", { ascending: false })
                .limit(10);
            return data || [];
        },
        enabled: !!user,
    });

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, []);

    // Generate QR code on canvas whenever pixData changes
    useEffect(() => {
        if (pixData?.copyPaste && qrCanvasRef.current && paymentStatus === "pending") {
            QRCode.toCanvas(qrCanvasRef.current, pixData.copyPaste, {
                width: 224,
                margin: 2,
                color: { dark: "#000000", light: "#ffffff" },
            }).catch((err: any) => {
                console.error("QR Code generation error:", err);
            });
        }
    }, [pixData, paymentStatus]);

    const handleCustomPurchase = () => {
        const amount = parseInt(customAmount, 10);
        if (isNaN(amount) || amount < 1) {
            toast.error("Insira um valor válido (mínimo 1 moeda).");
            return;
        }
        const pkg: CoinPackage = { moedas: amount, price_cents: amount * 100 };
        handlePurchase(pkg);
    };

    const handlePurchase = async (pkg: CoinPackage) => {
        if (!user || !session) {
            toast.error("Você precisa estar logado.");
            return;
        }

        setSelectedPackage(pkg);
        setLoading(true);
        setPaymentStatus("idle");

        try {
            const response = await fetch(`${SUPABASE_URL}/functions/v1/create-pix-payment`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                },
                body: JSON.stringify({
                    amount_cents: pkg.price_cents,
                    moedas: pkg.moedas + calcBonus(pkg.moedas),
                    ...(isImpersonating && user?.id ? { target_user_id: user.id } : {}),
                }),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || result.details || "Erro ao gerar PIX");
            }

            setPixData(result.data);
            setPaymentStatus("pending");

            // Start polling for payment status (use paymentId = correlationID)
            startPolling(result.data.paymentId);
        } catch (error: any) {
            console.error("Purchase error:", error);
            toast.error(error.message || "Erro ao gerar pagamento PIX");
            setPaymentStatus("error");
        } finally {
            setLoading(false);
        }
    };

    const startPolling = (paymentId: string) => {
        if (pollingRef.current) clearInterval(pollingRef.current);

        let attempts = 0;
        const maxAttempts = 180; // 15 minutes at 5s interval

        pollingRef.current = setInterval(async () => {
            attempts++;
            if (attempts > maxAttempts) {
                if (pollingRef.current) clearInterval(pollingRef.current);
                setPaymentStatus("error");
                toast.error("Tempo expirado. O pagamento não foi detectado.");
                return;
            }

            try {
                // Call check-pix-payment edge function (verifies with CyberPay and credits automatically)
                const response = await fetch(`${SUPABASE_URL}/functions/v1/check-pix-payment`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${session?.access_token}`,
                        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                    },
                    body: JSON.stringify({ paymentId }),
                });

                const result = await response.json();

                if (result.success && result.status === "PAID") {
                    if (pollingRef.current) clearInterval(pollingRef.current);
                    setPaymentStatus("paid");
                    toast.success("Pagamento confirmado! Moedas adicionadas à sua conta.");
                    queryClient.invalidateQueries({ queryKey: ["meu-saldo", user?.id] });
                    queryClient.invalidateQueries({ queryKey: ["meus-creditos-transacoes", user?.id] });
                }
            } catch (err) {
                // Polling errors are silent
            }
        }, 5000);
    };

    const handleCopyPaste = async () => {
        if (!pixData?.copyPaste) return;
        try {
            await navigator.clipboard.writeText(pixData.copyPaste);
            setCopied(true);
            toast.success("Código PIX copiado!");
            setTimeout(() => setCopied(false), 3000);
        } catch {
            toast.error("Erro ao copiar. Tente manualmente.");
        }
    };

    const handleClose = () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setPixData(null);
        setPaymentStatus("idle");
        setSelectedPackage(null);
        setCopied(false);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="animate-stagger-in">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Coins className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground tracking-tight">Moedas</h1>
                        <p className="text-muted-foreground text-sm">
                            Adicione créditos à sua conta via PIX
                        </p>
                    </div>
                </div>
            </div>

            {/* Current Balance */}
            <div
                className="animate-stagger-in"
                style={{ animationDelay: "80ms" }}
            >
                <div className="relative overflow-hidden rounded-2xl glass glow-border p-6">
                    <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-primary/5" />
                    <Sparkles className="absolute top-4 right-4 h-10 w-10 text-primary/15" />
                    <p className="text-sm font-medium text-muted-foreground">Saldo Atual</p>
                    <p className="text-4xl font-bold text-foreground mt-1">
                        {(saldo ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-sm text-primary font-medium mt-1">moedas disponíveis</p>
                </div>
            </div>

            {/* QR Code Modal / Payment Area */}
            {pixData && paymentStatus !== "idle" && (
                <div
                    className="animate-stagger-in"
                    style={{ animationDelay: "100ms" }}
                >
                    <Card className="overflow-hidden border-primary/20">
                        <CardHeader className="bg-primary/5 border-b border-primary/10">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <QrCode className="h-5 w-5 text-primary" />
                                {paymentStatus === "paid"
                                    ? "Pagamento Confirmado!"
                                    : "Escaneie o QR Code para pagar"
                                }
                            </CardTitle>
                            <CardDescription>
                                {paymentStatus === "paid"
                                    ? `${pixData.moedas} moedas foram adicionadas à sua conta`
                                    : `Pague R$ ${(pixData.amount_cents / 100).toFixed(2)} para receber ${pixData.moedas} moedas${calcBonus(pixData.amount_cents / 100) > 0 ? ` (inclui +${calcBonus(pixData.amount_cents / 100)} bônus)` : ""}`
                                }
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-6">
                            {paymentStatus === "paid" ? (
                                <div className="text-center py-8">
                                    <div className="mx-auto h-20 w-20 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                                        <CheckCircle2 className="h-10 w-10 text-green-500" />
                                    </div>
                                    <p className="text-lg font-semibold text-foreground mb-2">Pagamento Confirmado!</p>
                                    <p className="text-sm text-muted-foreground mb-6">
                                        {pixData.moedas} moedas foram adicionadas ao seu saldo.
                                    </p>
                                    <Button onClick={handleClose} className="w-full max-w-xs">
                                        Fechar
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-6">
                                    {/* QR Code Canvas */}
                                    <div className="relative p-4 bg-white rounded-2xl shadow-lg">
                                        <canvas
                                            ref={qrCanvasRef}
                                            className="w-56 h-56"
                                        />
                                    </div>

                                    {/* Status Polling Indicator */}
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                        Aguardando pagamento...
                                    </div>

                                    {/* Copy Paste */}
                                    <div className="w-full max-w-md space-y-2">
                                        <p className="text-xs font-medium text-muted-foreground text-center">
                                            Ou copie o código PIX Copia e Cola:
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 p-3 rounded-xl bg-muted/30 border border-border/50 text-xs text-foreground font-mono break-all max-h-20 overflow-y-auto">
                                                {pixData.copyPaste}
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleCopyPaste}
                                                className="shrink-0 gap-1.5"
                                            >
                                                {copied ? (
                                                    <>
                                                        <Check className="h-3.5 w-3.5" />
                                                        Copiado
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="h-3.5 w-3.5" />
                                                        Copiar
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Cancel button */}
                                    <Button variant="ghost" size="sm" onClick={handleClose} className="text-muted-foreground">
                                        Cancelar
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Coin Packages */}
            {!pixData && (
                <div>
                    <h2 className="text-base font-semibold text-foreground mb-3 animate-stagger-in" style={{ animationDelay: "160ms" }}>
                        Pacotes de Moedas
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {COIN_PACKAGES.map((pkg, i) => (
                            <div
                                key={pkg.moedas}
                                className="animate-stagger-in"
                                style={{ animationDelay: `${(i + 2) * 80}ms` }}
                            >
                                <div
                                    className={`relative overflow-hidden rounded-2xl p-5 transition-all duration-300 hover:scale-[1.03] cursor-pointer group ${pkg.popular
                                        ? "glass glow-border ring-1 ring-primary/30"
                                        : "glass glow-border glow-border-hover"
                                        }`}
                                    onClick={() => !loading && handlePurchase(pkg)}
                                >
                                    {pkg.popular && (
                                        <Badge className="absolute top-3 right-3 bg-primary/15 text-primary border-primary/25 text-[10px]">
                                            Popular
                                        </Badge>
                                    )}
                                    {calcBonus(pkg.moedas) > 0 && (
                                        <Badge className="absolute top-3 right-3 bg-green-500/15 text-green-500 border-green-500/25 text-[10px]" style={pkg.popular ? { top: '2.25rem' } : {}}>
                                            +{calcBonus(pkg.moedas)} grátis
                                        </Badge>
                                    )}

                                    <div className="absolute -bottom-4 -right-4 h-20 w-20 rounded-full bg-primary/5 group-hover:bg-primary/10 transition-colors" />

                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                            <Coins className="h-4 w-4 text-primary" />
                                        </div>
                                    </div>

                                    <p className="text-3xl font-bold text-foreground">
                                        {pkg.moedas}
                                        {calcBonus(pkg.moedas) > 0 && (
                                            <span className="text-lg text-green-500 font-semibold"> +{calcBonus(pkg.moedas)}</span>
                                        )}
                                    </p>
                                    <p className="text-sm text-muted-foreground">moedas</p>

                                    <div className="mt-4 flex items-center justify-between">
                                        <p className="text-lg font-semibold text-primary">
                                            R$ {(pkg.price_cents / 100).toFixed(2)}
                                        </p>
                                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Custom Amount */}
                    <div
                        className="mt-6 animate-stagger-in"
                        style={{ animationDelay: "500ms" }}
                    >
                        <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                            <PencilLine className="h-4 w-4 text-primary" />
                            Valor Personalizado
                        </h2>
                        <div className="rounded-2xl glass glow-border p-5">
                            <p className="text-sm text-muted-foreground mb-3">
                                Insira a quantidade de moedas que deseja comprar (1 moeda = R$ 1,00)
                            </p>
                            <div className="flex items-center gap-3">
                                <div className="relative flex-1 max-w-xs">
                                    <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                                    <Input
                                        type="number"
                                        min={1}
                                        placeholder="Ex: 25"
                                        value={customAmount}
                                        onChange={(e) => setCustomAmount(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                                {customAmount && parseInt(customAmount) >= 1 && (
                                    <span className="text-sm font-semibold text-primary whitespace-nowrap">
                                        R$ {(parseInt(customAmount) * 1).toFixed(2)}
                                    </span>
                                )}
                                {customAmount && parseInt(customAmount) >= 100 && calcBonus(parseInt(customAmount)) > 0 && (
                                    <span className="text-xs font-medium text-green-500 whitespace-nowrap">
                                        🎁 +{calcBonus(parseInt(customAmount))} moedas grátis!
                                    </span>
                                )}
                                <Button
                                    onClick={handleCustomPurchase}
                                    disabled={loading || !customAmount || parseInt(customAmount) < 1}
                                    className="shrink-0 gap-1.5"
                                >
                                    {loading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <ArrowRight className="h-4 w-4" />
                                    )}
                                    Comprar
                                </Button>
                            </div>
                        </div>
                    </div>

                    {loading && (
                        <div className="flex items-center justify-center gap-2 mt-6 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Gerando PIX...
                        </div>
                    )}
                </div>
            )}

            {/* Transaction History */}
            <div
                className="rounded-2xl glass glow-border p-6 animate-stagger-in"
                style={{ animationDelay: "600ms" }}
            >
                <h2 className="text-base font-semibold text-foreground mb-4">Histórico de Transações</h2>
                {transactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                        Nenhuma transação registrada ainda.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {transactions.map((tx: any) => (
                            <div
                                key={tx.id}
                                className="flex items-center gap-3 p-3 rounded-xl bg-muted/10 border border-border/30"
                            >
                                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${tx.tipo === "recarga_pix" ? "bg-green-500/10" : "bg-red-500/10"
                                    }`}>
                                    {tx.tipo === "recarga_pix" ? (
                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    ) : (
                                        <XCircle className="h-4 w-4 text-red-400" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">
                                        {tx.descricao || tx.tipo}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {format(new Date(tx.created_at), "dd/MM/yyyy HH:mm")}
                                    </p>
                                </div>
                                <span className={`text-sm font-semibold ${tx.tipo === "recarga_pix" ? "text-green-500" : "text-red-400"
                                    }`}>
                                    {tx.tipo === "recarga_pix" ? "+" : "-"}{Number(tx.quantidade).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
