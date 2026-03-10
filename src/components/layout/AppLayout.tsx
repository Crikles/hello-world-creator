import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useNavigate, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Megaphone, AlertTriangle, MessageCircle } from "lucide-react";

export function AppLayout() {
  const navigate = useNavigate();
  const { isImpersonating, exitImpersonation, user } = useAuth();

  const { data: whatsappConfig } = useQuery({
    queryKey: ["whatsapp-suporte-global"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_config")
        .select("value")
        .eq("key", "whatsapp_suporte")
        .maybeSingle();
      return data?.value ? String(data.value) : null;
    }
  });

  const handleSupportClick = () => {
    if (whatsappConfig) {
      window.open(`https://wa.me/${whatsappConfig}`, "_blank");
    }
  };

  const handleExitImpersonation = () => {
    exitImpersonation();
    navigate("/admin/usuarios");
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col relative">
          {/* Immersive background for main content */}
          <div className="fixed inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsla(43,74%,49%,0.03)_0%,_transparent_60%)]" />
            <div className="absolute inset-0 bg-grid-pattern opacity-20" />
          </div>

          {isImpersonating && (
            <div className="bg-destructive text-destructive-foreground py-2 px-6 flex items-center justify-between z-50 animate-in slide-in-from-top-2 border-b border-white/10 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm font-bold tracking-tight">
                  MODO DE VISUALIZAÇÃO: Você está acessando a conta de <span className="underline decoration-white/30">{user?.user_metadata?.full_name || user?.email}</span>
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="bg-white/10 hover:bg-white/20 border-white/20 text-white font-bold h-7 px-4 rounded-full transition-all active:scale-95"
                onClick={handleExitImpersonation}
              >
                Encerrar Visualização
              </Button>
            </div>
          )}

          {whatsappConfig && !isImpersonating && (
            <div
              onClick={handleSupportClick}
              className="bg-primary hover:bg-primary/90 text-primary-foreground py-2 px-4 shadow-md flex items-center justify-center gap-2 cursor-pointer transition-colors z-50 animate-in slide-in-from-top-2"
            >
              <Megaphone className="h-4 w-4" />
              <span className="text-sm font-medium tracking-wide">
                Está escalando? Entre em contato com o suporte para um plano personalizado de custos!
              </span>
            </div>
          )}

          {!isImpersonating && (
            <div
              onClick={() => window.open("https://chat.whatsapp.com/L2SKQrtAFu8C0WKJropR1F", "_blank")}
              className="bg-[hsl(142,70%,35%)] hover:bg-[hsl(142,70%,30%)] text-white py-2 px-4 flex items-center justify-center gap-2 cursor-pointer transition-colors z-50"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="text-sm font-medium tracking-wide">
                Entre na Comunidade do WhatsApp para ficar por dentro de todas as atualizações
              </span>
            </div>
          )}

          <header className="sticky top-0 z-40 h-12 glass-strong flex items-center px-4 gap-4">
            <SidebarTrigger className="text-muted-foreground hover:text-primary transition-colors" />
          </header>
          <main className="flex-1 p-6 overflow-auto relative z-10">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
