import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isLogisticsDomain } from "@/lib/domain-config";
import { Gauge, SendHorizonal, Megaphone, ShieldAlert, CircleDollarSign, Landmark, Cable, SlidersHorizontal, Store, LogOut, Coins, LifeBuoy, PackageX, Users, MessageCircle } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useLoja } from "@/contexts/LojaContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import integraxLogo from "@/assets/logo-integrax.jpeg";

// Preload checkout logos so they're cached before user navigates to Integracoes
import "@/assets/logo-vega.png";
import "@/assets/logo-zedy.png";
import "@/assets/logo-luna.png";
import "@/assets/logo-corvex.ico";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { user, signOut } = useAuth();
  const { loja } = useLoja();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

  // Realtime listener for credits updates
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`creditos-realtime-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "creditos", filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["meu-saldo", user.id] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);

  const base = loja ? `/loja/${loja.id}` : "";

  const menuSections = [
    {
      label: "Principal",
      items: [{ title: "Dashboard", url: base, icon: Gauge }],
    },
    {
      label: "Operações",
      items: [
        { title: "Envios", url: `${base}/envios`, icon: SendHorizonal },
        { title: "Postagens", url: `${base}/postagens`, icon: Megaphone },
        { title: "Taxação", url: `${base}/taxacao`, icon: ShieldAlert },
        { title: "Falha na Entrega", url: `${base}/falha-entrega`, icon: PackageX },
      ],
    },
    {
      label: "Financeiro",
      items: [
        { title: "Moedas", url: `${base}/moedas`, icon: CircleDollarSign },
        { title: "Indicação", url: `${base}/indicacao`, icon: Users },
      ],
    },
    {
      label: "Negócio",
      items: [
        { title: "Empresa", url: `${base}/empresa`, icon: Landmark },
        { title: "Integrações", url: `${base}/integracoes`, icon: Cable },
        { title: "WhatsApp", url: `${base}/whatsapp`, icon: MessageCircle },
      ],
    },
    {
      label: "Sistema",
      items: [
        { title: "Configurações", url: `${base}/configuracoes`, icon: SlidersHorizontal },
        { title: "Suporte", url: `${base}/suporte`, icon: LifeBuoy },
      ],
    },
  ];

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="p-5 border-b border-primary/5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={isLogisticsDomain() ? "/logojltransportes.png" : "/logo-magnus.png"}
              alt={isLogisticsDomain() ? "Logística JL Transportes" : "Magnus Frete"}
              className="h-12 w-12 rounded-xl object-contain"
            />
            <div className="absolute inset-0 rounded-xl border border-primary/15 animate-glow-pulse" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-primary truncate">
              {loja?.nome || "Logística JL Transportes"}
            </h2>
            <div className="flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-full glass glow-border w-fit">
              <Coins className="h-3 w-3 text-primary animate-glow-pulse" />
              <span className="text-xs text-primary font-semibold">
                {(saldo ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} moedas
              </span>
            </div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2 pt-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground/40 text-[10px] uppercase tracking-[0.15em] font-semibold px-3 mb-1">
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === base}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sidebar-foreground/60 hover:text-primary hover:bg-primary/5 transition-all duration-200"
                      activeClassName="glass glow-border text-primary font-semibold"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground/40 text-[10px] uppercase tracking-[0.15em] font-semibold px-3 mb-1">
            Parceiros Oficiais
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <a
              href="https://integrax.app/auth/register?a=0Zleb3"
              target="_blank"
              rel="noopener noreferrer"
              className="block mx-3 p-3 rounded-xl glass glow-border-hover transition-all duration-200 group"
            >
              <img
                src={integraxLogo}
                alt="IntegraX"
                className="w-full rounded-lg mb-2 group-hover:scale-[1.02] transition-transform"
              />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Disparos e Automação de vendas com SMS Global, RCS e WhatsApp
              </p>
            </a>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3 border-t border-primary/5 space-y-1">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground/50 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
          onClick={() => navigate("/lojas")}
        >
          <Store className="h-4 w-4 mr-2" />
          Trocar de Loja
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground/50 hover:text-destructive hover:bg-destructive/5 rounded-xl transition-all"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
