import { useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, Coins, Store, LogOut, Mail, FileText, DollarSign, MessageSquare, Contact, Bell, CreditCard, HeadphonesIcon, Smartphone, HeartPulse } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
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

const menuItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Usuários", url: "/admin/usuarios", icon: Users },
  { title: "Créditos", url: "/admin/creditos", icon: Coins },
  { title: "Templates", url: "/admin/templates", icon: FileText },
  
  { title: "Valores", url: "/admin/valores", icon: DollarSign },
  { title: "SMS", url: "/admin/sms", icon: MessageSquare },
  { title: "Leads", url: "/admin/leads", icon: Contact },
  { title: "Push Web", url: "/admin/push", icon: Bell },
  { title: "Pagamentos", url: "/admin/pagamentos", icon: CreditCard },
  { title: "WhatsApp", url: "/admin/whatsapp", icon: Smartphone },
  { title: "Emails", url: "/admin/emails", icon: Mail },
  { title: "Saúde Emails", url: "/admin/email-saude", icon: HeartPulse },
  { title: "Suporte", url: "/admin/suporte", icon: HeadphonesIcon },
];

export function AdminSidebar() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Users className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-sidebar-primary-foreground truncate">
              Painel Admin
            </h2>
            <p className="text-xs text-sidebar-foreground/60">Gestão do Sistema</p>
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
                      end={item.url === "/admin"}
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
          Voltar ao Painel
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
