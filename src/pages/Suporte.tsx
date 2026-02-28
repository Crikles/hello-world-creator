import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MessageCircle, HeadphonesIcon, HelpCircle, FileText, Zap } from "lucide-react";

export default function Suporte() {
    const { data: whatsappConfig } = useQuery({
        queryKey: ["whatsapp-suporte-page"],
        queryFn: async () => {
            const { data } = await supabase
                .from("system_config")
                .select("value")
                .eq("key", "whatsapp_suporte")
                .maybeSingle();
            return data?.value ? String(data.value) : null;
        }
    });

    const handleWhatsApp = () => {
        if (whatsappConfig) {
            window.open(`https://wa.me/${whatsappConfig}`, "_blank");
        }
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {/* Hero Section */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/90 to-primary p-8 md:p-12 text-primary-foreground shadow-xl">
                <div className="absolute inset-0 bg-[url('https://transparenttextures.com/patterns/cubes.png')] opacity-10" />
                <div className="relative z-10 grid gap-6 md:grid-cols-2 items-center">
                    <div className="space-y-4">
                        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">
                            Como podemos ajudar?
                        </h1>
                        <p className="text-primary-foreground/80 md:text-lg max-w-md">
                            Nossa equipe de especialistas está pronta para turbinar os seus resultados. Fale conosco agora mesmo.
                        </p>
                        <Button
                            size="lg"
                            variant="secondary"
                            className="mt-4 font-bold text-primary group hover:scale-105 transition-transform"
                            onClick={handleWhatsApp}
                            disabled={!whatsappConfig}
                        >
                            <MessageCircle className="mr-2 h-5 w-5 text-green-500 group-hover:animate-bounce" />
                            Falar no WhatsApp
                        </Button>
                    </div>
                    <div className="hidden md:flex justify-end">
                        <div className="h-40 w-40 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20 shadow-2xl">
                            <HeadphonesIcon className="h-20 w-20 text-white" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Cards Section */}
            <div className="grid gap-6 md:grid-cols-3">
                {[
                    {
                        icon: Zap,
                        title: "Planos Personalizados",
                        desc: "Está escalando? Fale com nosso time de vendas para negociar taxas diferenciadas baseadas no seu volume diário.",
                    },
                    {
                        icon: HelpCircle,
                        title: "Dúvidas Técnicas",
                        desc: "Problemas com integrações, falhas no rastreio ou dúvidas sobre faturamento? Nosso suporte técnico revolve rápido.",
                    },
                    {
                        icon: FileText,
                        title: "Tutoriais & Guias",
                        desc: "Acesse nossa central de ajuda oficial para tutoriais em vídeo, FAQs e passo a passo das integrações.",
                    }
                ].map((card, idx) => (
                    <div
                        key={idx}
                        className="glass rounded-xl p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 animate-stagger-in border border-border/50"
                        style={{ animationDelay: `${idx * 0.1}s` }}
                    >
                        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 text-primary">
                            <card.icon className="h-6 w-6" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">{card.title}</h3>
                        <p className="text-sm text-muted-foreground">{card.desc}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
