import { useNavigate } from "react-router-dom";
import { isLogisticsDomain } from "@/lib/domain-config";
import { LayoutDashboard, Package, Building2, Plug, Settings, Store, LogOut, Coins, Mail, AlertTriangle } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useLoja } from "@/contexts/LojaContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

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

  const base = loja ? `/loja/${loja.id}` : "";

  const menuItems = [
    { title: "Dashboard", url: base, icon: LayoutDashboard },
    { title: "Envios", url: `${base}/envios`, icon: Package },
    { title: "Postagens", url: `${base}/postagens`, icon: Mail },
    { title: "Taxação", url: `${base}/taxacao`, icon: AlertTriangle },
    { title: "Empresa", url: `${base}/empresa`, icon: Building2 },
    { title: "Integrações", url: `${base}/integracoes`, icon: Plug },
    { title: "Configurações", url: `${base}/configuracoes`, icon: Settings },
  ];

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img
            src={isLogisticsDomain() ? "/logojltransportes.png" : "/logo-magnus.png"}
            alt={isLogisticsDomain() ? "Logística JL Transportes" : "Magnus Frete"}
            className="h-14 w-14 rounded-lg object-contain"
          />
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-primary truncate">
              {loja?.nome || "Logística JL Transportes"}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Coins className="h-3 w-3 text-primary" />
              <span className="text-xs text-primary font-medium">{saldo ?? 0} moedas</span>
            </div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider">
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
                      className="flex items-center gap-3 px-3 py-2 rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
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
      </SidebarContent>
      <SidebarFooter className="p-3 border-t border-sidebar-border space-y-1">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground"
          onClick={() => navigate("/lojas")}
        >
          <Store className="h-4 w-4 mr-2" />
          Trocar de Loja
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground/70 hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
